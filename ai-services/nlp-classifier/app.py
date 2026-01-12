from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import joblib
import re
import os
import json
import requests
from pathlib import Path
from transformers import pipeline

MODEL_PATH = os.getenv("MODEL_PATH", "model/classifier.pkl")
VECTORIZER_PATH = os.getenv("VECTORIZER_PATH", "model/vectorizer.pkl")
INTENT_MODEL_PATH = os.getenv("INTENT_MODEL_PATH", "model/intent_classifier.pkl")

# Optional cloud fallback
CLOUD_PROVIDER = os.getenv("AI_CLOUD_PROVIDER", "").strip().lower()  # "hf" | "openai"
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "").strip()
HF_MODEL = os.getenv("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.2").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
try:
    CLOUD_CONFIDENCE_THRESHOLD = float(os.getenv("AI_CLOUD_CONFIDENCE_THRESHOLD", "0.65"))
except Exception:
    CLOUD_CONFIDENCE_THRESHOLD = 0.65
try:
    CLOUD_TIMEOUT_SECONDS = float(os.getenv("AI_CLOUD_TIMEOUT_SECONDS", "10"))
except Exception:
    CLOUD_TIMEOUT_SECONDS = 10.0

LOCAL_HF_ENABLED = os.getenv("AI_LOCAL_HF_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")
LOCAL_HF_MODEL = os.getenv("AI_LOCAL_HF_MODEL", "typeform/distilbert-base-uncased-mnli").strip()
try:
    LOCAL_HF_TRIGGER_THRESHOLD = float(os.getenv("AI_LOCAL_HF_TRIGGER_THRESHOLD", "0.55"))
except Exception:
    LOCAL_HF_TRIGGER_THRESHOLD = 0.55
try:
    LOCAL_HF_MIN_SCORE = float(os.getenv("AI_LOCAL_HF_MIN_SCORE", "0.60"))
except Exception:
    LOCAL_HF_MIN_SCORE = 0.60

# Try to load models
model = None
intent_model = None
vectorizer = None

hf_zero_shot = None

try:
    if Path(MODEL_PATH).exists() and Path(VECTORIZER_PATH).exists():
        model = joblib.load(MODEL_PATH)
        vectorizer = joblib.load(VECTORIZER_PATH)
        print(f"Successfully loaded model from {MODEL_PATH}")
    else:
        print(f"Model files not found. Using fallback classification.")
        print(f"Expected: {MODEL_PATH}, {VECTORIZER_PATH}")

    if Path(INTENT_MODEL_PATH).exists():
        intent_model = joblib.load(INTENT_MODEL_PATH)
        print(f"Successfully loaded intent model from {INTENT_MODEL_PATH}")

    if LOCAL_HF_ENABLED:
        hf_zero_shot = pipeline("zero-shot-classification", model=LOCAL_HF_MODEL)
        print(f"Successfully loaded local HF model: {LOCAL_HF_MODEL}")
except Exception as e:
    print(f"Failed to load model: {e}")
    print("Using fallback classification.")

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    category: str
    intent: str
    confidence: float

class EnrichRequest(BaseModel):
    text: str

class EnrichResponse(BaseModel):
    category: str
    intent: str
    confidence: float
    summary: str
    priority: str
    keywords: List[str]
    entities: dict
    auto_resolvable: bool
    suggested_workflow: Optional[str] = None
    approval_title: Optional[str] = None
    approval_body: Optional[str] = None

def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return text

def is_security_text(text: str) -> bool:
    lower = text.lower()
    return any(
        k in lower
        for k in [
            "phishing",
            "suspicious",
            "malware",
            "ransomware",
            "virus",
            "trojan",
            "hack",
            "hacked",
            "breach",
            "data breach",
            "unauthorized",
            "security incident",
        ]
    )

def _extract_json_object(text: str) -> Optional[dict]:
    # Extract the first JSON object found in a possibly chatty model response.
    if not text:
        return None
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    chunk = m.group(0)
    try:
        return json.loads(chunk)
    except Exception:
        return None

_CATEGORIES = [
    "IDENTITY_ACCESS",
    "NETWORK_VPN_WIFI",
    "EMAIL_COLLAB",
    "ENDPOINT_DEVICE",
    "HARDWARE_PERIPHERAL",
    "SOFTWARE_INSTALL_LICENSE",
    "BUSINESS_APP_ERP_CRM",
    "SECURITY_INCIDENT",
    "KB_GENERAL",
    "OTHER",
]

_INTENTS = [
    "INCIDENT",
    "SERVICE_REQUEST",
    "HOW_TO",
    "SECURITY_REPORT",
    "PASSWORD_RESET",
    "ACCOUNT_UNLOCK",
    "UNKNOWN",
]

def _local_hf_enrich(text: str) -> Optional[dict]:
    if not hf_zero_shot:
        return None
    try:
        cat_res = hf_zero_shot(text, candidate_labels=_CATEGORIES, multi_label=False)
        it_res = hf_zero_shot(text, candidate_labels=_INTENTS, multi_label=False)

        cat = cat_res.get("labels", [None])[0]
        cat_score = cat_res.get("scores", [0.0])[0]
        it = it_res.get("labels", [None])[0]
        it_score = it_res.get("scores", [0.0])[0]

        if not isinstance(cat, str) or not isinstance(it, str):
            return None
        if not isinstance(cat_score, (int, float)) or not isinstance(it_score, (int, float)):
            return None

        confidence = float(max(cat_score, it_score))
        return {
            "category": cat,
            "intent": it,
            "confidence": confidence,
        }
    except Exception:
        return None

def _cloud_enabled() -> bool:
    if CLOUD_PROVIDER == "hf":
        return bool(HF_API_TOKEN and HF_MODEL)
    if CLOUD_PROVIDER == "openai":
        return bool(OPENAI_API_KEY)
    return False

def _cloud_enrich(text: str) -> Optional[dict]:
    # Returns partial enrichment: {category, intent, priority, confidence}
    # Must never raise.
    if not _cloud_enabled():
        return None

    prompt = (
        "You are an IT support ticket classifier. Return ONLY valid JSON with keys: "
        "category, intent, priority, confidence.\n\n"
        "Allowed priority: LOW, MEDIUM, HIGH.\n"
        "Allowed intent examples: INCIDENT, SERVICE_REQUEST, HOW_TO, SECURITY_REPORT, ACCOUNT_ACCESS, UNKNOWN.\n"
        "Allowed category examples: IDENTITY_ACCESS, NETWORK_VPN_WIFI, EMAIL_COLLAB, ENDPOINT_DEVICE, BUSINESS_APP_ERP_CRM, "
        "SOFTWARE_INSTALL_LICENSE, HARDWARE_PERIPHERAL, SECURITY_INCIDENT, KB_GENERAL, OTHER.\n\n"
        f"Ticket:\n{text}\n"
    )

    try:
        if CLOUD_PROVIDER == "hf":
            url = f"https://api-inference.huggingface.co/models/{HF_MODEL}"
            headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
            payload = {
                "inputs": prompt,
                "parameters": {"max_new_tokens": 180, "temperature": 0.2, "return_full_text": False},
            }
            res = requests.post(url, headers=headers, json=payload, timeout=CLOUD_TIMEOUT_SECONDS)
            if not res.ok:
                return None
            data = res.json()
            # Common response: [{"generated_text": "..."}]
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                text_out = data[0].get("generated_text")
                if isinstance(text_out, str):
                    return _extract_json_object(text_out)
            # Sometimes HF returns dict errors
            return None

        if CLOUD_PROVIDER == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            }
            payload = {
                "model": OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": "Return ONLY JSON. No markdown."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 200,
            }
            res = requests.post(url, headers=headers, json=payload, timeout=CLOUD_TIMEOUT_SECONDS)
            if not res.ok:
                return None
            data = res.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )
            if isinstance(content, str):
                return _extract_json_object(content) or _extract_json_object(content.strip())
            return None

        return None
    except Exception:
        return None

app = FastAPI(title="AI NLP Classifier", version="1.0.0")

def fallback_classify(text: str) -> PredictResponse:
    """Fallback classification when model is not available - Enhanced with more keywords"""
    text_lower = text.lower()
    
    # Enhanced keyword-based classification with more variations
    if any(kw in text_lower for kw in ["password", "reset", "forgot", "account", "login", "access", "unlock", "locked", "username"]):
        category = "IDENTITY_ACCESS"
        confidence = 0.75
    elif any(kw in text_lower for kw in ["wifi", "wi-fi", "wireless", "network", "vpn", "internet", "connection", "connect", "cannot connect", "no internet", "slow internet"]):
        category = "NETWORK_VPN_WIFI"
        confidence = 0.75
    elif any(kw in text_lower for kw in ["email", "outlook", "mail", "calendar", "not sending", "not receiving", "mailbox"]):
        category = "EMAIL_COLLAB"
        confidence = 0.75
    elif any(kw in text_lower for kw in ["laptop", "computer", "printer", "monitor", "keyboard", "mouse", "hardware", "screen", "display", "headphones"]):
        category = "HARDWARE_PERIPHERAL"
        confidence = 0.75
    elif any(kw in text_lower for kw in ["software", "install", "application", "app", "program", "update", "license", "crashes"]):
        category = "SOFTWARE_INSTALL_LICENSE"
        confidence = 0.75
    elif any(kw in text_lower for kw in ["sap", "oracle", "crm", "erp", "salesforce", "business app"]):
        category = "BUSINESS_APP_ERP_CRM"
        confidence = 0.8
    elif any(kw in text_lower for kw in ["phishing", "malware", "security", "virus", "hack", "breach", "suspicious", "stolen", "lost laptop"]):
        category = "SECURITY_INCIDENT"
        confidence = 0.85
    elif any(kw in text_lower for kw in ["backup", "backup failed", "backup not working", "backup error", "cannot backup", "restore"]):
        category = "OTHER"
        confidence = 0.7
    elif any(kw in text_lower for kw in ["how", "how to", "how do", "tutorial", "guide", "steps"]):
        category = "KB_GENERAL"
        confidence = 0.7
    else:
        category = "OTHER"
        confidence = 0.6
    
    return PredictResponse(category=category, intent="classify", confidence=confidence)

def extract_keywords(text: str) -> List[str]:
    lower = text.lower()
    candidates = [
        "password", "reset", "unlock", "locked", "login", "access",
        "vpn", "wifi", "network", "internet", "connection",
        "email", "outlook", "mail", "calendar",
        "printer", "print", "laptop", "computer", "screen", "mouse", "keyboard",
        "install", "software", "update", "license",
        "phishing", "malware", "security", "virus", "hack",
        "sap", "oracle", "crm", "erp",
        "urgent", "critical", "down", "broken", "error",
    ]
    out: List[str] = []
    for c in candidates:
        if c in lower and c not in out:
            out.append(c)
    return out[:20]

def extract_entities(text: str) -> dict:
    entities = {
        "emails": [],
        "usernames": [],
        "asset_tags": [],
        "error_codes": [],
    }

    emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    entities["emails"] = list(dict.fromkeys([e.lower() for e in emails]))[:5]

    for m in re.finditer(r"\b(username|user id|userid)\s*[:=]?\s*([a-zA-Z0-9._-]{3,})\b", text, re.IGNORECASE):
        entities["usernames"].append(m.group(2))
    entities["usernames"] = list(dict.fromkeys(entities["usernames"]))[:5]

    asset = re.findall(r"\b([A-Z]{2,5}-\d{3,10})\b", text)
    entities["asset_tags"] = list(dict.fromkeys(asset))[:5]

    errs = re.findall(r"\b(0x[0-9A-Fa-f]+|ERR_[A-Z0-9_]+|\d{3,5})\b", text)
    entities["error_codes"] = list(dict.fromkeys(errs))[:5]

    return entities

def guess_priority(text: str) -> str:
    lower = text.lower()
    if any(
        k in lower
        for k in [
            "phishing",
            "suspicious",
            "malware",
            "ransomware",
            "virus",
            "trojan",
            "hack",
            "hacked",
            "breach",
            "data breach",
            "unauthorized",
            "security incident",
        ]
    ):
        return "HIGH"
    if any(k in lower for k in ["urgent", "critical", "down", "outage", "cannot work", "blocked"]):
        return "HIGH"
    if any(k in lower for k in ["can't", "cannot", "not working", "error"]):
        return "MEDIUM"
    return "LOW"

def suggest_workflow(text: str, category: str) -> tuple[bool, Optional[str], Optional[str], Optional[str]]:
    lower = text.lower()
    if any(kw in lower for kw in ["password", "reset", "forgot"]):
        return True, "PASSWORD_RESET", "Confirm password reset", "AI can reset your password and send a reset notification. Approve to proceed."
    if any(kw in lower for kw in ["account", "unlock", "locked", "lockout"]):
        return True, "ACCOUNT_UNLOCK", "Confirm account unlock", "AI can unlock your account. Approve to proceed."
    if category == "NETWORK_VPN_WIFI" and any(kw in lower for kw in ["vpn", "connect", "connection"]):
        return True, "VPN_BASIC_FIX", "Confirm VPN troubleshooting", "AI can run automated VPN connectivity checks and guide you through fixes. Approve to proceed."
    if category == "HARDWARE_PERIPHERAL" and any(kw in lower for kw in ["printer", "print"]):
        return True, "PRINTER_TROUBLESHOOT", "Confirm printer troubleshooting", "AI can run printer troubleshooting steps and guide you. Approve to proceed."
    return False, None, None, None

def make_summary(text: str) -> str:
    clean = re.sub(r"\s+", " ", text.strip())
    if len(clean) <= 160:
        return clean
    return clean[:157] + "..."

@app.post("/predict", response_model=PredictResponse)
@app.post("/", response_model=PredictResponse)  # Also support root endpoint for backward compatibility
def predict(req: PredictRequest):
    if not model or not vectorizer:
        # Use fallback classification
        return fallback_classify(req.text)
    
    cleaned = clean_text(req.text)
    X = vectorizer.transform([cleaned])
    pred = model.predict(X)[0]

    pred_intent = "classify"
    if intent_model is not None:
        try:
            pred_intent = str(intent_model.predict(X)[0])
        except Exception:
            pred_intent = "classify"
    try:
        prob = float(max(model.predict_proba(X)[0]))
    except Exception:
        prob = 0.5

    if is_security_text(req.text):
        return PredictResponse(category="SECURITY_INCIDENT", intent="SECURITY_REPORT", confidence=max(round(prob, 3), 0.85))

    return PredictResponse(category=pred, intent=pred_intent, confidence=round(prob, 3))

@app.post("/enrich", response_model=EnrichResponse)
def enrich(req: EnrichRequest):
    base = predict(PredictRequest(text=req.text))
    summary = make_summary(req.text)
    keywords = extract_keywords(req.text)
    entities = extract_entities(req.text)
    priority = guess_priority(req.text)

    if not is_security_text(req.text):
        if base.confidence < LOCAL_HF_TRIGGER_THRESHOLD:
            local = _local_hf_enrich(req.text)
            if isinstance(local, dict) and float(local.get("confidence", 0.0)) >= LOCAL_HF_MIN_SCORE:
                cat = local.get("category")
                it = local.get("intent")
                cf = local.get("confidence")
                if isinstance(cat, str) and cat.strip():
                    base.category = cat.strip()
                if isinstance(it, str) and it.strip():
                    base.intent = it.strip()
                if isinstance(cf, (int, float)):
                    try:
                        base.confidence = float(cf)
                    except Exception:
                        pass

        if base.confidence < CLOUD_CONFIDENCE_THRESHOLD:
            cloud = _cloud_enrich(req.text)
            if isinstance(cloud, dict):
                cat = cloud.get("category")
                it = cloud.get("intent")
                pr = cloud.get("priority")
                cf = cloud.get("confidence")

                if isinstance(cat, str) and cat.strip():
                    base.category = cat.strip()
                if isinstance(it, str) and it.strip():
                    base.intent = it.strip()
                if pr in ("LOW", "MEDIUM", "HIGH"):
                    priority = pr
                if isinstance(cf, (int, float)):
                    try:
                        base.confidence = float(cf)
                    except Exception:
                        pass

    auto_resolvable, wf, at, ab = suggest_workflow(req.text, base.category)
    return EnrichResponse(
        category=base.category,
        intent=base.intent,
        confidence=base.confidence,
        summary=summary,
        priority=priority,
        keywords=keywords,
        entities=entities,
        auto_resolvable=auto_resolvable,
        suggested_workflow=wf,
        approval_title=at,
        approval_body=ab,
    )

@app.get("/")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

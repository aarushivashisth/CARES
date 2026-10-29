// Conservative English-only keyword guard; not a clinical triage system.
// Absence of a match never means the situation is safe.
export function safetyGate(text) {
  if (/\b(chest pain|can'?t breathe|cannot breathe|difficulty breathing|severe breath|unconscious|stroke|heavy bleeding|overdose|suicid\w*|kill myself|self.harm)\b/i.test(text)) return { status: 'emergency', message: 'Possible emergency: in India call 112 now or seek urgent local emergency care. Do not wait for CARES. This keyword check cannot assess your condition.' };
  if (/\b(diagnos\w*|prescrib\w*|dosage|dose|which medicine|treatment plan)\b/i.test(text)) return { status: 'refused', message: 'CARES cannot diagnose or prescribe. Please consult a qualified clinician. I can help find services.' };
  if (/\b(ignore (all |previous |system )?instructions|system prompt|api.?key|jwt.?secret|execute sql|drop table|other patient|all patient|bypass|pretend you|act as)\b/i.test(text)) return { status: 'refused', message: 'I can only help with supported service navigation and authorized information.' };
  return null;
}

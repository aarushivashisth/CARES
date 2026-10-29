"""Offline-only, reproducible prototype. No records or network access required."""
import hashlib
import json
import platform
import re
import resource
import time
from pathlib import Path
import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'ml/data/navigation-v1.json'
data = json.loads(source.read_text())
classes = sorted(data['classes'])
# Group split by wording template, shared across classes. Parallel template
# paraphrases never occur on both sides of a split; final test untouched in tuning.
groups = {'train': list(range(10)), 'validation': [10,11,12], 'test': [13,14,15]}
sets = {split: ([data['classes'][c][i] for c in classes for i in ids], [c for c in classes for i in ids]) for split,ids in groups.items()}
normalized = [re.sub(r'\W+', ' ', text.lower()).strip() for texts,_ in sets.values() for text in texts]
assert len(normalized) == len(set(normalized)), 'Duplicate examples'
vectorizer = TfidfVectorizer(lowercase=True, token_pattern=r'(?u)\b[a-z][a-z]+\b', ngram_range=(1,1), sublinear_tf=False)
xtrain = vectorizer.fit_transform(sets['train'][0])
xval = vectorizer.transform(sets['validation'][0])
trials = []
for c in [0.5,1,2,4,8]:
    model = LogisticRegression(C=c, max_iter=2000, random_state=42, class_weight='balanced').fit(xtrain,sets['train'][1])
    score = f1_score(sets['validation'][1],model.predict(xval),average='macro',zero_division=0)
    trials.append((score,c,model))
_, chosen_c, model = max(trials,key=lambda x: (x[0], -x[1]))
validation_probabilities=model.predict_proba(xval)
ordered=np.sort(validation_probabilities,axis=1)
confidence_threshold=float(max(0.25, ordered[:,-1].min()*0.8))
margin_threshold=float(max(0.06, (ordered[:,-1]-ordered[:,-2]).min()*0.8))
# Final refit uses training plus validation only, retaining the train vocabulary.
xdev = vectorizer.transform(sets['train'][0]+sets['validation'][0])
ydev = sets['train'][1]+sets['validation'][1]
model = LogisticRegression(C=chosen_c,max_iter=2000,random_state=42,class_weight='balanced').fit(xdev,ydev)
xtest = vectorizer.transform(sets['test'][0])
def evaluate(candidate, x):
    predicted = candidate.predict(x)
    timings=[]
    for _ in range(100):
        start=time.perf_counter(); candidate.predict(x[:1]); timings.append((time.perf_counter()-start)*1000)
    return {'accuracy':accuracy_score(sets['test'][1],predicted), 'macro_f1':f1_score(sets['test'][1],predicted,average='macro',zero_division=0), 'per_class':classification_report(sets['test'][1],predicted,output_dict=True,zero_division=0), 'confusion_matrix':confusion_matrix(sets['test'][1],predicted,labels=classes).tolist(), 'latency_ms_median_batch_one_model_only':float(np.median(timings)), 'errors':[{'text':t,'expected':y,'predicted':p} for t,y,p in zip(sets['test'][0],sets['test'][1],predicted) if y!=p]}
baseline=evaluate(model,xtest)
# A small neural experiment is feasible; it is not a pretrained transformer.
neural_trials=[]
for hidden in [16,32]:
    net=MLPClassifier(hidden_layer_sizes=(hidden,hidden), max_iter=1500,random_state=42,alpha=0.01).fit(xtrain.toarray(),sets['train'][1])
    score=f1_score(sets['validation'][1],net.predict(xval.toarray()),average='macro',zero_division=0)
    neural_trials.append((score,hidden))
_, hidden=max(neural_trials,key=lambda x:(x[0],-x[1]))
net=MLPClassifier(hidden_layer_sizes=(hidden,hidden),max_iter=1500,random_state=42,alpha=0.01).fit(xdev.toarray(),ydev)
neural=evaluate(net,xtest.toarray())
neural['parameter_bytes']=sum(w.nbytes for w in net.coefs_+net.intercepts_)
# Neutral JSON weights, avoiding pickle execution and Python in request runtime.
artifact={'version':data['version'],'dataset_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'classes':model.classes_.tolist(),'vocabulary':vectorizer.vocabulary_,'idf':vectorizer.idf_.tolist(),'weights':model.coef_.tolist(),'intercept':model.intercept_.tolist(),'confidence_threshold':confidence_threshold,'margin_threshold':margin_threshold,'disclosure':'Limited synthetic specialty-intent prototype, not a symptom classifier or clinically validated system.'}
output=ROOT/'backend/src/ai/carematch-model.json'
output.write_text(json.dumps(artifact,sort_keys=True,separators=(',',':'))+'\n')
results={'dataset_version':data['version'],'dataset_sha256':artifact['dataset_sha256'],'synthetic':True,'size':sum(len(x) for x in data['classes'].values()),'class_counts':{c:len(data['classes'][c]) for c in classes},'splits':{k:{'count':len(v[0]),'template_group_ids':groups[k]} for k,v in sets.items()},'classes':classes,'seed':42,'selected_C':chosen_c,'confidence_threshold':confidence_threshold,'margin_threshold':margin_threshold,'threshold_selection':'80% of minimum training-only-model validation confidence/margin, with floors 0.25/0.06; uncalibrated, plus explicit-intent guard','validation_trials':[{'C':c,'macro_f1':score} for score,c,_ in trials], 'baseline':baseline,'neural':neural,'selected_neural_hidden_layers':[hidden,hidden],'artifact_bytes':output.stat().st_size,'baseline_parameter_bytes':model.coef_.nbytes+model.intercept_.nbytes,'peak_process_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'environment':{'python':platform.python_version(),'sklearn':sklearn.__version__},'limitations':['80 synthetic explicit navigation intents, no authentic patient language','Small test set and correlated author/template vocabulary; metrics do not generalize to symptoms','No clinical label review, no multilingual evaluation','Neural comparison is a tiny MLP, not transformer fine tuning','Latency excludes vectorization, network, cold starts and provider lookup; RSS includes both experiments']}
(ROOT/'ml/evaluation.json').write_text(json.dumps(results,indent=2)+'\n')
# Golden probabilities verify exact Node vectorization and inference parity.
(ROOT/'ml/parity.json').write_text(json.dumps([{'text':t,'probabilities':model.predict_proba(vectorizer.transform([t]))[0].tolist()} for t in sets['test'][0]],indent=2)+'\n')
print(json.dumps({'baseline_macro_f1':baseline['macro_f1'],'neural_macro_f1':neural['macro_f1'],'test_count':len(sets['test'][0]),'artifact_bytes':output.stat().st_size}))

"""Read-only source/artifact review. Never opens database or ignored env files."""
import json
import re
import subprocess
import zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
files=sorted(set(filter(None,tracked+untracked)))
blocked=[f for f in tracked if re.search(r'\.(?:db|sqlite3?)(?:$|-)',f) or (Path(f).name.startswith('.env') and not f.endswith('.example'))]
findings=[]
patterns=[re.compile('-----BEGIN '+'(?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),re.compile(r'\bAIza[0-9A-Za-z_-]{30,}\b'),re.compile(r'\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}'),re.compile(r'(?:postgres|postgresql)://[^\s:@]+:[^\s@]{8,}@(?!(?:localhost|db\.example|.*\.invalid))')]
for filename in files:
 p=root/filename
 if p.suffix.lower() not in {'.js','.jsx','.json','.py','.md','.sql','.example','.mjs','.yml','.yaml'} or filename=='scripts/releaseAudit.py':continue
 for number,line in enumerate(p.read_text(errors='replace').splitlines(),1):
  if any(pattern.search(line) for pattern in patterns):findings.append({'file':filename,'line':number,'category':'potential_secret_pattern'})
archives=[]
for filename in tracked:
 if filename.endswith('.zip'):
  with zipfile.ZipFile(root/filename) as archive:
   unsafe=[n for n in archive.namelist() if (Path(n).name=='.env' or re.search(r'\.(?:db|sqlite3?)(?:$|-)',n))]
   archives.append({'file':filename,'sensitiveNamedEntries':unsafe,'contentRead':False})
bundle=[]
for p in (root/'frontend/dist').rglob('*.js'):
 value=p.read_text()
 for marker in ['localhost:5000','development_secret_key','ANTHROPIC_API_KEY','GEMINI_API_KEY','DATABASE_URL=postgres']:
  if marker in value:bundle.append({'file':str(p.relative_to(root)),'markerType':'backend_config_or_localhost'})
result={'scope':'Heuristic source/production-bundle pattern scan plus tracked-file and archive entry-name review; not a full security certification. No database or ignored secret env contents opened.','sourceFilesConsidered':len(files),'trackedDatabasesOrPrivateEnv':blocked,'potentialSecrets':findings,'archiveNamesOnly':archives,'frontendBundleFindings':bundle,'passed':not blocked and not findings and not bundle and not any(a['sensitiveNamedEntries'] for a in archives)}
(root/'docs/RELEASE_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'sourceFilesConsidered':len(files),'trackedSensitiveFiles':len(blocked),'potentialSecretFindings':len(findings),'bundleFindings':len(bundle)}))
raise SystemExit(0 if result['passed'] else 1)

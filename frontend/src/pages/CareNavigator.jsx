import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import './Dashboard.css';
export default function CareNavigator() {
  const [mode,setMode]=useState('navigate');const [question,setQuestion]=useState('');const [result,setResult]=useState(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [turns,setTurns]=useState([]);
  const [type,setType]=useState('doctors');const [query,setQuery]=useState('');const [data,setData]=useState(null);
  async function ask(e) {
    e.preventDefault();setBusy(true);setError('');setResult(null);
    try {
      const history=turns.slice(-2).flatMap(turn=>[{role:'user',content:turn.question},{role:'assistant',content:turn.result.answer || turn.result.message || ''}]);
      const body=mode==='navigate'&&history.length?{question,history}:{question};
      const answer=(await api.post(`/ai/${mode}`,body)).data;
      setResult(answer);
      if(mode==='navigate')setTurns(previous=>[...previous.slice(-9),{question,result:answer}]);
    } catch(err){setError(err.message);} finally{setBusy(false);}
  }
  async function search(e) { e.preventDefault();setBusy(true);setError('');setData(null);try{setData((await api.post('/ai/lookup',{type,query:type==='my_appointments'?'':query})).data);}catch(err){setError(err.message);}finally{setBusy(false);} }
  return <main className="page-width" style={{padding:'32px 0 64px'}}>
    <h1>CARES AI Care Navigator</h1>
    <p role="note">Service navigation only. This assistant cannot diagnose, prescribe or confirm bookings. For emergencies in India, <a href="tel:112">call 112</a> immediately.</p>
    <p>Do not include names, contact details, medical history or patient records. Navigation questions and retrieved public passages are sent to the configured external language model. Private appointment lookup stays within CARES. Up to two prior navigation turns provide follow-up context; conversations are kept in this page’s memory and cleared on reload.</p>
    <form className="care-form" onSubmit={ask}>
      <label>Navigation mode<select aria-label="Navigation mode" value={mode} onChange={e=>{setMode(e.target.value);setResult(null);setTurns([]);}}><option value="navigate">Ask about CARES services (LLM with sources)</option><option value="carematch">CareMatch specialty intent (limited synthetic model)</option></select></label>
      <label>Your service question<textarea required minLength={3} maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={mode==='carematch'?'Find a dermatologist':'Is a home care enquiry a confirmed booking?'}/></label>
      <button className="primary-button" disabled={busy}>{busy?'Working…':'Ask for navigation help'}</button>
    </form>
    {error&&<p role="alert">{error}</p>}
    {result&&<section aria-label="Navigation response" role="status"><h2>{result.status==='matched'?'Specialty suggestion':result.status==='answered'?'Answer with retrieved sources':'Navigation response'}</h2><p>{result.answer || result.message}</p>{result.disclosure&&<p>{result.disclosure}</p>}
      {result.specialty&&<p>Suggested service: {result.specialty}. <Link to={`/doctors?specialty=${encodeURIComponent(result.specialty)}`}>Browse this specialty</Link></p>}
      {result.providers&&(result.providers.length?<ul>{result.providers.map(p=><li key={p.id}><Link to={`/doctors/${p.id}`}>{p.full_name}</Link> — {p.specialty} · {p.is_synthetic?'Synthetic demo provider':`${p.provenance_status}; ${p.verification_status}`} {p.source_url&&<a href={p.source_url} target="_blank" rel="noreferrer">Directory source</a>}</li>)}</ul>:<p>No matching providers returned from the CARES directory.</p>)}
      {result.citations?.length>0&&<ul>{result.citations.map(c=><li key={c.id}><a href={c.url} target={c.url.startsWith('https:')?'_blank':undefined} rel="noreferrer">[{c.id}] {c.title}</a><p>Checked: {c.retrievedAt}</p><blockquote>{c.excerpt}</blockquote></li>)}</ul>}
    </section>}
    {turns.length>0&&<details><summary>Previous turns in this session</summary><ol>{turns.slice(0,-1).map((turn,i)=><li key={i}><strong>You: {turn.question}</strong><p>{turn.result.answer || turn.result.message}</p>{turn.result.citations?.map(c=><a key={c.id} href={c.url}>[{c.id}] {c.title} </a>)}</li>)}</ol><button onClick={()=>{setTurns([]);setResult(null);}}>Clear conversation</button></details>}
    <section><h2>Search actual CARES records</h2><p>These bounded database lookups are separate from generated guidance. Published slots are request options, not guaranteed availability.</p>
      <form className="care-form" onSubmit={search}><label>Lookup<select aria-label="Lookup" value={type} onChange={e=>{setType(e.target.value);setData(null);}}>{[['doctors','Doctors'],['hospitals','Hospitals'],['specialties','Specialties'],['departments','Departments'],['my_appointments','My appointments (patient sign in required)']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        {type!=='my_appointments'&&<label>Search text<input maxLength={80} value={query} onChange={e=>setQuery(e.target.value)}/></label>}<button disabled={busy}>Search CARES records</button></form>
      {data&&(data.data.length?<ul className="care-requests">{data.data.map((row,i)=><li key={row.id || i}>{data.type==='doctors'?<><Link to={`/doctors/${row.id}`}>{row.full_name}</Link> — {row.specialty}</>:data.type==='hospitals'||data.type==='departments'?<><Link to={`/hospitals/${row.id}`}>{row.name}</Link> — {row.city}<p>Departments: {row.departments.join(', ') || 'Not recorded'}</p></>:data.type==='specialties'?row.specialty:<Link to="/patient/dashboard">#{row.id}: {row.doctor_name}, {row.requested_date}, {row.preferred_slot} — {row.status}</Link>}{'is_synthetic' in row&&<p>{row.is_synthetic?'Synthetic demo record':`${row.provenance_status}; ${row.verification_status}`}</p>}</li>)}</ul>:<p>No records match this lookup.</p>)}
    </section>
  </main>;
}

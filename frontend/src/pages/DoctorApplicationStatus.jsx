import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import './Dashboard.css';
export default function DoctorApplicationStatus() {
  const [data,setData]=useState(null);const [error,setError]=useState('');const [response,setResponse]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;api.get('/doctor/portal/verification').then(res=>{if(active)setData(res.data);}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[]);
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await api.post('/doctor/portal/verification/clarify',{clarification_response:response});setData((await api.get('/doctor/portal/verification')).data);setResponse('');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <main className="page-width" style={{padding:'32px 0 64px'}}><h1>Doctor application status</h1><p>This restricted session supports credential review only. Practice and appointment access require approval.</p>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading review…</p>}{data&&<section><h2>{data.doctor?.verificationStatus?.replaceAll('_',' ') || 'Review status'}</h2><p>{data.application?.clarificationRequest}</p>{data.doctor?.verificationStatus==='needs_clarification'&&<form className="care-form" onSubmit={submit}><label>Credential clarification<textarea required minLength={10} maxLength={2000} value={response} onChange={e=>setResponse(e.target.value)}/></label><button disabled={busy}>Send clarification</button></form>}{data.doctor?.verificationStatus==='verified'&&<p><Link to="/login">Sign in to your approved doctor portal</Link></p>}</section>}</main>;
}

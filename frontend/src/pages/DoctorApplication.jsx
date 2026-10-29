import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import './Dashboard.css';
export default function DoctorApplication() {
  const [form,setForm]=useState({email:'',password:'',full_name:'',specialty:'',license_number:'',experience_years:'0',bio:''});
  const [error,setError]=useState('');const [sent,setSent]=useState(false);const [saving,setSaving]=useState(false);
  async function submit(e) { e.preventDefault();setSaving(true);setError('');try{await api.post('/auth/apply-doctor',{...form,experience_years:Number(form.experience_years)});setForm({...form,password:''});setSent(true);}catch(err){setError(err.message);}finally{setSaving(false);} }
  return <main className="page-width" style={{padding:'32px 0 64px'}}><h1>Apply as a doctor</h1><p>Credentials require administrative review. Applying does not verify your credentials, enable sign in or confirm appointments. Do not submit patient information.</p>
    {error&&<p role="alert">{error}</p>}{sent ? <p role="status">Application submitted for review. Practice access becomes available after approval. <Link to="/login?application=1">View application status</Link>.</p> : <form className="care-form" onSubmit={submit}>
    {[['full_name','Full name','text'],['email','Professional email','email'],['password','Password','password'],['specialty','Specialty','text'],['license_number','Registration / license number','text'],['experience_years','Years of experience','number']].map(([key,label,type])=><label key={key}>{label}<input required type={type} min={type==='number'?0:undefined} max={type==='number'?80:undefined} minLength={key==='password'?10:key==='license_number'?4:undefined} maxLength={150} autoComplete={key==='password'?'new-password':undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
    <label>Professional biography (optional)<textarea maxLength={1500} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label><button className="primary-button" disabled={saving}>{saving?'Submitting…':'Submit application for review'}</button></form>}
  </main>;
}

import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/apiClient.js';
import { useAuth } from '../context/useAuth.js';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const services = { nursing: 'Nursing support enquiry', physiotherapy: 'Home physiotherapy enquiry', elder_support: 'Elder support enquiry' };
export default function HomeCare() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const patient = user?.role === 'patient';
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(patient || admin);
  const [dates] = useState(() => ({today:new Date().toISOString().slice(0,10),max:new Date(Date.now()+90*86400000).toISOString().slice(0,10)}));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ service_type: 'nursing', requested_date: '', contact_phone: '', address: '', city: '' });
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await api.get('/home-care'); setRows(res.data); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active=true;
    if (patient || admin) {
      api.get('/home-care').then(res=>{if(active)setRows(res.data);}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});
    }
    return ()=>{active=false;};
  }, [patient,admin]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try { const res = await api.post('/home-care', form); setNotice(res.message); setForm({ ...form, address: '', contact_phone: '' }); await load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function status(id, value) {
    setSaving(true); setError('');
    try { await api.patch(`/home-care/${id}/status`, { status: value }); setDetail(null); await load(); setNotice(`Request status: ${value.replaceAll('_',' ')}`); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function show(id) {
    setError('');
    try { setDetail((await api.get(`/home-care/${id}`)).data); }
    catch (err) { setError(err.message); }
  }
  return <main className="page-width" style={{ padding: '32px 0 64px' }}>
    <h1>Care at Home</h1>
    <p role="note">Request a non-emergency service review. This is an enquiry, not a confirmed booking. CARES does not guarantee availability, price, a visit or a provider assignment. For emergencies in India, <a href="tel:112">call 112</a>.</p>
    <p>Supported enquiries: nursing support, home physiotherapy and non-emergency elder support. An administrator reviews your request and may contact you to discuss next steps.</p>
    {!patient && !admin && <p><Link to="/login">Sign in as a patient</Link> to request support. <Link to="/register">Create an account</Link>.</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {patient && <form onSubmit={submit} className="care-form">
      <h2>Request a review</h2>
      <p>Provide only contact and visit location details. Do not enter diagnoses, medical records or other health information. Only you and authorized administrators can see the details.</p>
      <label>Service<select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}>{Object.entries(services).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Preferred date<input required type="date" min={dates.today} max={dates.max} value={form.requested_date} onChange={e => setForm({ ...form, requested_date: e.target.value })}/></label>
      <label>Contact phone<input required type="tel" maxLength={25} value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}/></label>
      <label>Visit address<input required minLength={8} maxLength={240} autoComplete="street-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}/></label>
      <label>City<input required minLength={2} maxLength={80} autoComplete="address-level2" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}/></label>
      <button className="primary-button" disabled={saving}>{saving ? 'Sending…' : 'Send service enquiry'}</button>
    </form>}
    {(patient || admin) && <section aria-label="Service requests">
      <h2>{admin ? 'Review service enquiries' : 'Your service enquiries'}</h2>
      <button onClick={load} disabled={loading}>Refresh requests</button>
      {loading ? <p role="status">Loading enquiries…</p> : rows.length === 0 ? <p>No service enquiries yet.</p> : <ul className="care-requests">{rows.map(row => <li key={row.id}>
        <h3>{services[row.service_type]}</h3><p>{row.requested_date} · {row.city} · <strong>{row.status.replaceAll('_',' ')}</strong></p>
        <button onClick={() => show(row.id)}>View request #{row.id}</button>
        {patient && !['closed','declined','cancelled'].includes(row.status) && <button disabled={saving} onClick={() => status(row.id,'cancelled')}>Cancel enquiry #{row.id}</button>}
        {admin && ({requested:['under_review','declined'],under_review:['contacted','declined'],contacted:['closed','declined']}[row.status] || []).map(next => <button key={next} disabled={saving} onClick={() => status(row.id,next)}>Mark {next.replaceAll('_',' ')} #{row.id}</button>)}
      </li>)}</ul>}
      {detail && <section aria-label="Request details"><h3>Request #{detail.id}</h3><p>{detail.address}, {detail.city}</p><p>{detail.contact_phone}</p><ol>{detail.history.map((event,i) => <li key={i}>{event.status.replaceAll('_',' ')} — {event.created_at}</li>)}</ol><button onClick={() => setDetail(null)}>Hide details</button></section>}
    </section>}
  </main>;
}

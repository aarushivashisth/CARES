import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeCare from '../pages/HomeCare.jsx';
import { api } from '../services/apiClient.js';
import { useAuth } from '../context/useAuth.js';
vi.mock('../context/useAuth.js',()=>({useAuth:vi.fn()}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
beforeEach(()=>{ useAuth.mockReturnValue({user:{role:'patient'}}); });
const renderPage=()=>render(<MemoryRouter><HomeCare/></MemoryRouter>);
it('creates an enquiry, states limits, and refreshes persisted requests',async()=>{
  vi.spyOn(api,'get').mockResolvedValue({success:true,data:[]});
  vi.spyOn(api,'post').mockResolvedValue({success:true,message:'Enquiry received, not a confirmed booking.',data:{id:4}});
  renderPage();
  await screen.findByText('No service enquiries yet.');
  expect(screen.getByRole('note').textContent).toContain('not a confirmed booking');
  for(const [name,value] of [['Preferred date','2026-11-01'],['Contact phone','9876543210'],['Visit address','Synthetic test address'],['City','Chandigarh']]) fireEvent.change(screen.getByLabelText(name),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:'Send service enquiry'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/home-care',expect.objectContaining({service_type:'nursing',city:'Chandigarh'})));
  expect(await screen.findByRole('status')).toBeDefined();
});
it('shows admin transitions and handles API failures',async()=>{
  useAuth.mockReturnValue({user:{role:'admin'}});
  vi.spyOn(api,'get').mockResolvedValue({data:[{id:1,service_type:'nursing',status:'requested',city:'Test',requested_date:'2026-11-01'}]});
  vi.spyOn(api,'patch').mockRejectedValue(new Error('Conflict; refresh'));
  renderPage();
  fireEvent.click(await screen.findByRole('button',{name:'Mark under review #1'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Conflict');
  expect(screen.queryByRole('button',{name:'Send service enquiry'})).toBeNull();
});
it('requires sign in and permits patient cancellation',async()=>{
  useAuth.mockReturnValue({user:null}); renderPage();
  expect(screen.getByRole('link',{name:'Sign in as a patient'}).getAttribute('href')).toBe('/login');
});
it('shows private details and patient cancellation',async()=>{
  vi.spyOn(api,'get').mockImplementation(async path=>({data:path==='/home-care' ? [{id:1,status:'requested',service_type:'nursing'}] : {id:1,address:'Synthetic address',contact_phone:'12345678',history:[{status:'requested',created_at:'test'}]}}));
  vi.spyOn(api,'patch').mockResolvedValue({success:true}); renderPage();
  fireEvent.click(await screen.findByRole('button',{name:'View request #1'}));
  expect(await screen.findByText('12345678')).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'Cancel enquiry #1'}));
  await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/home-care/1/status',{status:'cancelled'}));
});

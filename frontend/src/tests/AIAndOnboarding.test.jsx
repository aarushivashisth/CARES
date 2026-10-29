import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,it,expect,vi } from 'vitest';
import CareNavigator from '../pages/CareNavigator.jsx';
import DoctorApplication from '../pages/DoctorApplication.jsx';
import DoctorDiscovery from '../DoctorDiscovery.jsx';
import DoctorProfile from '../DoctorProfile.jsx';
import { api } from '../services/apiClient.js';
vi.mock('../context/useAuth.js',()=>({useAuth:()=>({user:null})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const show=page=>render(<MemoryRouter>{page}</MemoryRouter>);
it('connects to backend RAG, renders traceable citations, and handles unavailability',async()=>{
 vi.spyOn(api,'post').mockResolvedValueOnce({data:{status:'answered',answer:'An enquiry is not a booking. [cares-home-1]',citations:[{id:'cares-home-1',title:'CARES Home Care',url:'/home-care',excerpt:'Source passage',retrievedAt:'2026-10-29'}]}}).mockResolvedValueOnce({data:{status:'unavailable',answer:'The language model is not configured.'}});
 show(<CareNavigator/>);fireEvent.change(screen.getByLabelText('Your service question'),{target:{value:'What is home care?'}});fireEvent.click(screen.getByRole('button',{name:'Ask for navigation help'}));
 expect(await screen.findByRole('link',{name:'[cares-home-1] CARES Home Care'})).toBeDefined();
 expect(api.post).toHaveBeenCalledWith('/ai/navigate',{question:'What is home care?'});
 fireEvent.click(screen.getByRole('button',{name:'Ask for navigation help'}));expect(await screen.findByText('The language model is not configured.')).toBeDefined();
});
it('connects specialty prediction to actual providers and labels synthetic records',async()=>{
 vi.spyOn(api,'post').mockResolvedValue({data:{status:'matched',specialty:'Cardiology',message:'Prototype navigation',providers:[{id:9,full_name:'Synthetic Doctor',specialty:'Cardiology',is_synthetic:1}]}});
 show(<CareNavigator/>);fireEvent.change(screen.getByLabelText('Navigation mode'),{target:{value:'carematch'}});fireEvent.change(screen.getByLabelText('Your service question'),{target:{value:'Find a cardiologist'}});fireEvent.click(screen.getByRole('button',{name:'Ask for navigation help'}));
 expect((await screen.findByRole('link',{name:'Synthetic Doctor'})).getAttribute('href')).toBe('/doctors/9');expect(screen.getByText(/Synthetic demo provider/)).toBeDefined();
});
it('displays authorized structured query errors',async()=>{
 vi.spyOn(api,'post').mockRejectedValue(new Error('Patient authentication is required.'));
 show(<CareNavigator/>);fireEvent.change(screen.getByLabelText('Lookup'),{target:{value:'my_appointments'}});fireEvent.click(screen.getByRole('button',{name:'Search CARES records'}));
 expect((await screen.findByRole('alert')).textContent).toContain('authentication');
});
it('submits doctor credentials for review and does not log in automatically',async()=>{
 vi.spyOn(api,'post').mockResolvedValue({success:true});show(<DoctorApplication/>);
 for(const [name,value] of [['Full name','Synthetic Doctor'],['Professional email','synthetic@example.com'],['Password','Synthetic@12345'],['Specialty','Cardiology'],['Registration / license number','TEST-ONLY-001']])fireEvent.change(screen.getByLabelText(name),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Submit application for review'}));expect((await screen.findByRole('status')).textContent).toContain('Practice access becomes available after approval');expect(api.post).toHaveBeenCalledWith('/auth/apply-doctor',expect.objectContaining({license_number:'TEST-ONLY-001'}));
});
it('fails visibly when directory is unavailable without inserting fallback providers',async()=>{
 vi.spyOn(api,'get').mockRejectedValue(new Error('Directory unavailable'));show(<DoctorDiscovery/>);
 await waitFor(()=>expect(screen.getByText(/Directory unavailable/)).toBeDefined());
 expect(screen.queryByText('Dr. Maya Bennett')).toBeNull();
});
it('fails visibly when profile API is unavailable without a fallback booking panel',async()=>{
 vi.spyOn(api,'get').mockRejectedValue(new Error('Profile unavailable'));show(<DoctorProfile/>);
 expect(await screen.findByText('Profile unavailable')).toBeDefined();expect(screen.queryByText('Dr. Maya Bennett')).toBeNull();
});

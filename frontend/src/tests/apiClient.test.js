import {it,expect,vi,afterEach} from 'vitest';
import {api} from '../services/apiClient.js';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('uses same-origin API and attaches bearer token without adding credentials to URL',async()=>{
 localStorage.setItem('cares_auth_token','synthetic-token');const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true,data:[]})});vi.stubGlobal('fetch',request);
 await api.get('/doctors');expect(request).toHaveBeenCalledWith('/api/doctors',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer synthetic-token'})}));
});
it('rejects SPA HTML returned as successful API response',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>{throw new SyntaxError('HTML');}}));await expect(api.get('/doctors')).rejects.toMatchObject({code:'INVALID_API_RESPONSE'});
});
it('preserves HTTP authorization errors and handles network failure',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:'Forbidden',code:'FORBIDDEN'})}));await expect(api.get('/admin')).rejects.toMatchObject({status:403,code:'FORBIDDEN'});
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));await expect(api.get('/doctors')).rejects.toMatchObject({code:'BACKEND_UNAVAILABLE'});
});

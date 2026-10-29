import { Router } from '../middleware/asyncRouter.js';
import { predict } from '../ai/carematch.js';
import { navigate } from '../ai/navigator.js';
import { lookup } from '../ai/providerTools.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { sharedRateLimiter } from '../middleware/sharedRateLimit.js';
const router=Router();
router.use(sharedRateLimiter('ai',{maxRequests:process.env.NODE_ENV==='test'?300:20,windowMs:60000}));
function question(body) {
  if (!body || Object.keys(body).some(k=>k!=='question') || typeof body.question!=='string' || body.question.trim().length<3 || body.question.length>600) throw Object.assign(new Error('Enter a service question between 3 and 600 characters.'),{status:400});
  return body.question.trim();
}
router.post('/carematch',async(req,res)=>{
  const result=predict(question(req.body));
  const providers=result.status==='matched' ? (await lookup({type:'doctors',specialty:result.specialty})).data : [];
  res.json({success:true,data:{...result,providers}});
});
router.post('/navigate',async(req,res)=>{
  try {
    const {history,...body}=req.body || {};
    const input=question(body);
    if (history !== undefined && (!Array.isArray(history) || history.length>6 || history.some(m=>!m || !['user','assistant'].includes(m.role) || typeof m.content!=='string' || m.content.length>(m.role==='user'?600:4000) || Object.keys(m).some(k=>!['role','content'].includes(k))))) throw Object.assign(new Error('Invalid bounded conversation history.'),{status:400});
    res.json({success:true,data:await navigate(input,{history:history || []})});
  }
  catch(err) {
    if (err.name==='TimeoutError' || err.name==='AbortError') return res.status(504).json({success:false,error:'The assistant timed out. Please use directory navigation.',code:'AI_TIMEOUT'});
    throw err;
  }
});
// The model never chooses database operations. This explicit, bounded tool UI
// invokes allowlisted queries and displays results separately from generation.
router.post('/lookup',async(req,res,next)=>{
  if (req.body?.type==='my_appointments') return authenticateToken(req,res,async(err)=>{
    if (err) return next(err);
    try { res.json({success:true,data:await lookup(req.body,req.user)}); } catch(error) { next(error); }
  });
  res.json({success:true,data:await lookup(req.body)});
});
export default router;

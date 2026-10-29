import { test,expect } from '@playwright/test';
async function login(page,email,password) {
 await page.goto('/login');await page.getByLabel('Email Address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in to CARES'}).click();await expect(page).toHaveURL(/dashboard/);
}
test('emergency contacts survive API failure, nested refresh, and narrow viewport',async({page})=>{
 await page.route('**/api/hospitals?emergency=true',route=>route.abort());await page.goto('/emergency');
 await expect(page.getByRole('link',{name:'Call 112 National Emergency Helpline',exact:true})).toHaveAttribute('href','tel:112');
 await expect(page.getByTestId('emergency-error')).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Emergency Healthcare Resources'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('patient creates persistent home enquiry; administrator reviews it through UI',async({page})=>{
 await login(page,'patient@cares.org','Patient@12345');await page.getByRole('link',{name:/Care at Home — request/}).click();
 await page.getByLabel('Preferred date').fill(new Date(Date.now()+86400000).toISOString().slice(0,10));await page.getByLabel('Contact phone').fill('9876543210');await page.getByLabel('Visit address').fill('Synthetic browser test address');await page.getByLabel('City',{exact:true}).fill('Chandigarh');
 await page.getByRole('button',{name:'Send service enquiry'}).click();await expect(page.getByText('Enquiry received.',{exact:false})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:/View request #/}).first()).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(page,'admin@cares.org','Admin@12345');await page.getByRole('link',{name:/Care at Home — review/}).click();
 await page.getByRole('button',{name:/Mark under review #/}).first().click();await expect(page.getByRole('button',{name:/Mark contacted #/}).first()).toBeVisible();
});
test('real CareMatch model and authorized tools are connected; emergency bypasses generation',async({page})=>{
 await page.goto('/navigator');await page.getByLabel('Navigation mode').selectOption('carematch');await page.getByLabel('Your service question').fill('Find a cardiologist');await page.getByRole('button',{name:'Ask for navigation help'}).click();
 await expect(page.getByText('Suggested service: Cardiology.',{exact:false})).toBeVisible();await expect(page.getByText(/limited synthetic prototype/).first()).toBeVisible();
 await page.getByLabel('Your service question').fill('I have chest pain');await page.getByRole('button',{name:'Ask for navigation help'}).click();await expect(page.getByText(/Possible emergency: in India call 112 now/)).toBeVisible();
 await page.getByLabel('Lookup',{exact:true}).selectOption('my_appointments');await page.getByRole('button',{name:'Search CARES records'}).click();await expect(page.getByRole('alert')).toContainText('Authentication required');
});
test('new patient registration and doctor application connect to real APIs',async({page})=>{
 const suffix=`${Date.now()}-${test.info().project.name}`;
 await page.goto('/register');await page.getByLabel('Full Name',{exact:true}).fill('Synthetic Browser Patient');await page.getByLabel('Email Address').fill(`browser-${suffix}@example.com`);await page.getByLabel(/^Password/).fill('Synthetic@12345');await page.getByRole('button',{name:/Complete Patient Registration/i}).click();await expect(page).toHaveURL('/patient/dashboard');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.goto('/apply-doctor');
 for(const [label,value] of [['Full name','Synthetic Browser Doctor'],['Professional email',`doctor-${suffix}@example.com`],['Password','Synthetic@12345'],['Specialty','Cardiology'],['Registration / license number',`TEST-${suffix}`]])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Submit application for review'}).click();await expect(page.getByRole('status')).toContainText('Application submitted for review');
 await page.getByRole('link',{name:'View application status'}).click();await page.getByLabel('Email Address').fill(`doctor-${suffix}@example.com`);await page.getByLabel('Password',{exact:true}).fill('Synthetic@12345');await page.getByRole('button',{name:'Sign in to CARES'}).click();await expect(page).toHaveURL('/doctor/application');await expect(page.getByRole('heading',{level:2,name:'pending',exact:true})).toBeVisible();
});

test('patient-to-doctor appointment request, acceptance and patient cancellation persist',async({page})=>{
 await login(page,'patient@cares.org','Patient@12345');await page.goto('/doctors/2');
 const days=test.info().project.name==='mobile'?6:5;
 await page.getByLabel('Requested Date').fill(new Date(Date.now()+days*86400000).toISOString().slice(0,10));await page.getByRole('button',{name:/9:00 AM/}).click();await page.getByRole('button',{name:'Submit Appointment Request'}).click();await expect(page.getByText('Request Submitted Successfully',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(page,'dr.daniel@cares.org','Doctor@12345');
 const row=page.locator('.dashboard-list-item').filter({hasText:new Date(Date.now()+days*86400000).toISOString().slice(0,10)}).first();await row.getByRole('button',{name:'✓ Accept',exact:true}).click();await expect(row.locator('.status-badge')).toContainText('accepted');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(page,'patient@cares.org','Patient@12345');
 const patientRow=page.locator('.dashboard-list-item').filter({hasText:new Date(Date.now()+days*86400000).toISOString().slice(0,10)}).first();await expect(patientRow.locator('.status-badge')).toContainText('accepted');page.once('dialog',dialog=>dialog.accept());await patientRow.getByRole('button',{name:/Cancel/}).click();await expect(patientRow.locator('.status-badge')).toContainText('cancelled');
});

test('provider application is approved through the administrator UI and can sign in',async({page})=>{
 const suffix=`approve-${Date.now()}-${test.info().project.name}`;
 const email=`${suffix}@example.com`;await page.goto('/apply-doctor');
 for(const [label,value] of [['Full name','Synthetic Review Doctor'],['Professional email',email],['Password','Synthetic@12345'],['Specialty','Dermatology'],['Registration / license number',`TEST-${suffix}`]])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Submit application for review'}).click();await expect(page.getByRole('status')).toContainText('Application submitted');await login(page,'admin@cares.org','Admin@12345');
 const row=page.locator('.dashboard-list-item').filter({hasText:`TEST-${suffix}`});await row.getByRole('button',{name:'✓ Approve',exact:true}).click();await page.getByLabel('Administrative Note / Justification').fill('Synthetic workflow test only; no real credentials or provider verified.');await page.getByRole('button',{name:'Confirm approved',exact:true}).click();await expect(row.locator('.status-badge')).toContainText('approved');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await login(page,email,'Synthetic@12345');await expect(page).toHaveURL('/doctor/dashboard');
});
test('hospital management persists explicit hours without inventing emergency coverage',async({page})=>{
 await login(page,'hospital@riverside.org','Hospital@12345');await page.getByRole('button',{name:'Edit Facility Info ✎',exact:true}).click();await page.getByLabel('OPD / Regular Operating Hours',{exact:true}).fill('Synthetic schedule: weekdays 09:00–17:00');await page.getByLabel('Emergency Care Hours',{exact:true}).fill('');await page.getByRole('button',{name:'Save Facility Details',exact:true}).click();await expect(page.getByText('Facility details and operating schedule updated successfully.')).toBeVisible();await page.reload();await page.getByRole('button',{name:'Edit Facility Info ✎',exact:true}).click();await expect(page.getByLabel('Emergency Care Hours',{exact:true})).toHaveValue('');
});
test('public routes fit the viewport and support refresh',async({page})=>{
 for(const path of ['/','/doctors','/hospitals','/home-care','/navigator','/apply-doctor','/login']){
  await page.goto(path);await expect(page.getByRole('main').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`horizontal overflow on ${path}`).toBe(true);
 }
});

import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
vi.mock('../src/firestore',()=>({saveHealthRecord:vi.fn(),readActiveWorkout:vi.fn(),addItem:vi.fn(),updateItem:vi.fn(),deleteItem:vi.fn(),importTransactions:vi.fn()}));
vi.mock('../src/assistant/api',()=>({userRequest:vi.fn(),scanStatementPage:vi.fn()}));
vi.mock('../src/utils/image-statement',()=>({screenshotPayload:vi.fn()}));
import {saveHealthRecord,readActiveWorkout,addItem,importTransactions} from '../src/firestore';
import {userRequest,scanStatementPage} from '../src/assistant/api';
import {screenshotPayload} from '../src/utils/image-statement';
import NutritionStudio from '../src/components/health/NutritionStudio';
import HealthLog from '../src/components/health/HealthLog';
import StatementImport from '../src/components/StatementImport';
const t={surface:'#fff',surface2:'#eee',text:'#111',muted:'#555',line:'#ddd',a1:'#035',onAccent:'#fff'};
const user={uid:'u'},profile={age:25,medicalStatus:'none',updatedAt:'v1'};
const meal={id:'rice',slot:'lunch',name:'Rice and lentils',ingredients:[{fdcId:172421,name:'Lentils',grams:200}],nutrients:{cal:400,protein:20},method:'Warm and serve.'};
const response={nextMeal:meal,plan:[meal],alternatives:[meal],summary:{remainingToUserTargets:{},workoutMinutesLast7Days:20},source:{kind:'reference snapshot',retrievedAt:'2026-09-28'},generatedAt:'2026-09-28',notes:[]};
const run=async fn=>fn();
beforeEach(()=>{vi.clearAllMocks();readActiveWorkout.mockResolvedValue(null);saveHealthRecord.mockResolvedValue();addItem.mockResolvedValue();userRequest.mockResolvedValue(response);});
afterEach(cleanup);
it('requires consent, saves a plan without meals, and logs an eaten meal with a stable ID',async()=>{
 const view=render(<NutritionStudio t={t} user={user} profile={profile} meals={[]} run={run} busy={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Open meal assistant'}));
 const generate=screen.getByRole('button',{name:'Suggest next meal & plan today'});expect(generate.disabled).toBe(true);expect(userRequest).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(generate);await screen.findByText('Review your daily plan');
 fireEvent.click(screen.getByRole('button',{name:'Save this daily plan'}));
 await waitFor(()=>expect(saveHealthRecord).toHaveBeenCalledTimes(1));expect(saveHealthRecord.mock.calls[0][1]).toBe('mealPlans');
 const saved=saveHealthRecord.mock.calls[0][3];view.unmount();
 render(<NutritionStudio t={t} user={user} profile={profile} meals={[]} savedPlan={saved} run={run} busy={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Open meal assistant'}));
 fireEvent.click(screen.getByRole('button',{name:'I ate this · add to food log'}));
 await waitFor(()=>expect(saveHealthRecord).toHaveBeenCalledTimes(2));expect(saveHealthRecord.mock.calls[1][1]).toBe('meals');expect(saveHealthRecord.mock.calls[1][2]).toMatch(/^plan_.*_lunch$/);
});
it('manual meal logging preserves unknown nutrients as null, not zero',async()=>{
 render(<HealthLog t={t} userId="u" kind="meals" records={[]} run={run} busy={false}/>);
 fireEvent.change(screen.getByLabelText('Food / meal name'),{target:{value:'Lunch'}});fireEvent.change(screen.getByLabelText('Energy (kcal)'),{target:{value:'500'}});
 fireEvent.click(screen.getByRole('button',{name:'Add to log'}));
 await waitFor(()=>expect(addItem).toHaveBeenCalledWith('u','meals',expect.objectContaining({cal:500,protein:null,iron:null})));
});
it('scans an uploaded screenshot and waits for explicit review before importing',async()=>{
 screenshotPayload.mockResolvedValue({imageBase64:'image'});scanStatementPage.mockResolvedValue({rows:[{date:'2026-09-28',type:'expense',amount:90,note:'Tea',category:'Food'}],warnings:[]});importTransactions.mockResolvedValue({saved:1,skipped:0});
 render(<StatementImport t={t} user={user} tx={[]} wallets={[]} onClose={()=>{}} onImported={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Statement file'),{target:{files:[new File(['sample'],'payment.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'Scan statement'}));await screen.findByLabelText('Amount row 1');
 expect(scanStatementPage).toHaveBeenCalledWith(user,{imageBase64:'image'});expect(importTransactions).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Amount row 1'),{target:{value:'95'}});fireEvent.click(screen.getByRole('button',{name:'Import 1 transactions'}));
 await waitFor(()=>expect(importTransactions).toHaveBeenCalledWith('u',expect.arrayContaining([expect.objectContaining({amount:'95',type:'expense'})]),expect.any(Function)));
});

it('restores a paused workout and saves only completed sets with a stable session ID',async()=>{
 const {default:WorkoutStudio}=await import('../src/components/health/WorkoutStudio');
 readActiveWorkout.mockResolvedValue({id:'session-1',name:'Practice',date:'2026-09-28',elapsed:120000,runningSince:null,effort:4,sets:[{name:'Chair squat',reps:'8',load:'',done:true},{name:'Wall push-up',reps:'',load:'',done:false}]});
 render(<WorkoutStudio t={t} userId="u" profile={{age:25,medicalStatus:'none'}} workouts={[]} sleep={[]} run={run} busy={false}/>);
 await screen.findByRole('button',{name:'Resume timer'});fireEvent.click(screen.getByRole('button',{name:'Finish & save completed activity'}));
 await waitFor(()=>expect(saveHealthRecord).toHaveBeenCalledWith('u','workouts','session-1',expect.objectContaining({minutes:2,effort:4,sets:[{name:'Chair squat',reps:8,load:null}]})));
 await waitFor(()=>expect(localStorage.getItem('lifeos_workout_v1_u')).toBeNull());
});
it('does not offer guided workouts when exercise restrictions are recorded',async()=>{
 const {default:WorkoutStudio}=await import('../src/components/health/WorkoutStudio');
 render(<WorkoutStudio t={t} userId="other" profile={{age:25,medicalStatus:'none',injury:true}} workouts={[]} sleep={[]} run={run} busy={false}/>);
 expect((await screen.findByRole('button',{name:'Start session'})).disabled).toBe(true);
});
it('opens a dedicated meal dialog with inline preferences and omnivore selection',async()=>{
 const onSaveProfile=vi.fn().mockResolvedValue();
 render(<NutritionStudio t={t} user={user} profile={{targets:{},allergies:[]}} meals={[]} run={run} busy={false} onSaveProfile={onSaveProfile}/>);
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Open meal assistant'}));
 expect(screen.getByRole('dialog',{name:'Life OS meal assistant'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Age'),{target:{value:'25'}});
 fireEvent.change(screen.getByLabelText('Food preference'),{target:{value:'omnivore'}});
 fireEvent.change(screen.getByLabelText('Health considerations'),{target:{value:'none'}});
 fireEvent.click(screen.getByRole('button',{name:'Save health preferences'}));
 await waitFor(()=>expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({age:25,diet:'omnivore',medicalStatus:'none'})));
 fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(screen.queryByRole('dialog')).toBeNull();
});
it('opens preference correction when the server reports missing setup instead of requesting a report',async()=>{
 userRequest.mockResolvedValue({blocked:true,needsSetup:true,message:'Complete age in Health preferences. No health report is required.'});
 render(<NutritionStudio t={t} user={user} profile={profile} meals={[]} run={run} busy={false} onSaveProfile={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Open meal assistant'}));
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Suggest next meal & plan today'}));
 await screen.findByText('Complete age in Health preferences. No health report is required.');
 expect(screen.getByRole('button',{name:'Save health preferences'})).toBeTruthy();
 expect(screen.queryByText('Review your daily plan')).toBeNull();
});
it('explains general-only planning for undisclosed health considerations',async()=>{
 userRequest.mockResolvedValue({...response,generalOnly:true,modeMessage:'General food ideas without personal nutrient targets.'});
 render(<NutritionStudio t={t} user={user} profile={{...profile,medicalStatus:'unsure'}} meals={[]} run={run} busy={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Open meal assistant'}));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Suggest next meal & plan today'}));
 await screen.findByText('General food ideas without personal nutrient targets.');
 expect(screen.getByText('General ideas · no personal nutrient targets applied')).toBeTruthy();
});
it('lets a user review a mistaken health choice directly from the restriction message',async()=>{
 userRequest.mockResolvedValue({blocked:true,canEditPreferences:true,message:'Your saved choice is Medical condition / prescribed diet.'});
 render(<NutritionStudio t={t} user={user} profile={profile} meals={[]} run={run} busy={false} onSaveProfile={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Open meal assistant'}));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Suggest next meal & plan today'}));
 fireEvent.click(await screen.findByRole('button',{name:'Review saved health choice'}));
 expect(screen.getByRole('button',{name:'Save health preferences'})).toBeTruthy();
});

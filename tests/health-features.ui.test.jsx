import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
vi.mock('../src/firestore',()=>({saveHealthRecord:vi.fn(),addItem:vi.fn(),updateItem:vi.fn(),deleteItem:vi.fn(),importTransactions:vi.fn()}));
vi.mock('../src/assistant/api',()=>({userRequest:vi.fn(),scanStatementPage:vi.fn()}));
vi.mock('../src/utils/image-statement',()=>({screenshotPayload:vi.fn()}));
import {saveHealthRecord,addItem,importTransactions} from '../src/firestore';
import {userRequest,scanStatementPage} from '../src/assistant/api';
import {screenshotPayload} from '../src/utils/image-statement';
import NutritionStudio from '../src/components/health/NutritionStudio';
import HealthLog from '../src/components/health/HealthLog';
import StatementImport from '../src/components/StatementImport';
const t={surface:'#fff',surface2:'#eee',text:'#111',muted:'#555',line:'#ddd',a1:'#035',onAccent:'#fff'};
const user={uid:'u'},profile={age:25,updatedAt:'v1'};
const meal={id:'rice',slot:'lunch',name:'Rice and lentils',ingredients:[{fdcId:172421,name:'Lentils',grams:200}],nutrients:{cal:400,protein:20},method:'Warm and serve.'};
const response={nextMeal:meal,plan:[meal],alternatives:[meal],summary:{remainingToUserTargets:{},workoutMinutesLast7Days:20},source:{kind:'reference snapshot',retrievedAt:'2026-09-28'},generatedAt:'2026-09-28',notes:[]};
const run=async fn=>fn();
beforeEach(()=>{vi.clearAllMocks();saveHealthRecord.mockResolvedValue();addItem.mockResolvedValue();userRequest.mockResolvedValue(response);});
afterEach(cleanup);
it('requires consent, saves a plan without meals, and logs an eaten meal with a stable ID',async()=>{
 const view=render(<NutritionStudio t={t} user={user} profile={profile} meals={[]} run={run} busy={false}/>);
 const generate=screen.getByRole('button',{name:'Suggest next meal & plan today'});expect(generate.disabled).toBe(true);expect(userRequest).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(generate);await screen.findByText('Review your daily plan');
 fireEvent.click(screen.getByRole('button',{name:'Save this daily plan'}));
 await waitFor(()=>expect(saveHealthRecord).toHaveBeenCalledTimes(1));expect(saveHealthRecord.mock.calls[0][1]).toBe('mealPlans');
 const saved=saveHealthRecord.mock.calls[0][3];view.unmount();
 render(<NutritionStudio t={t} user={user} profile={profile} meals={[]} savedPlan={saved} run={run} busy={false}/>);
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
 localStorage.setItem('lifeos_workout_v1_u',JSON.stringify({id:'session-1',name:'Practice',date:'2026-09-28',elapsed:120000,runningSince:null,effort:4,sets:[{name:'Chair squat',reps:'8',load:'',done:true},{name:'Wall push-up',reps:'',load:'',done:false}]}));
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

import React from 'react';
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
vi.mock('../src/cloud-notifications',()=>({notificationSettings:vi.fn(),readDeliveryPreferences:vi.fn(),setEmailDelivery:vi.fn(),registerPush:vi.fn(),getPushState:vi.fn()}));
vi.mock('../src/notifications',()=>({enableReminders:vi.fn(),remindersEnabled:()=>false}));
vi.mock('../src/auth',()=>({sendWelcomeEmail:vi.fn()}));
import * as channels from '../src/cloud-notifications';
import {enableReminders} from '../src/notifications';
import {sendWelcomeEmail} from '../src/auth';
import {inviteReminderSetup} from '../src/reminder-onboarding';
import ReminderSetup from '../src/components/ReminderSetup';
const theme={surface:'#fff',surface2:'#eee',text:'#111',muted:'#555',line:'#ddd',a1:'#036'};
const user=(time=1)=>({uid:'u',email:'student@college.edu',getIdTokenResult:async()=>({claims:{auth_time:time}})});
beforeEach(()=>{sessionStorage.clear();inviteReminderSetup('u');vi.clearAllMocks();channels.notificationSettings.mockResolvedValue({emailConfigured:true,pushConfigured:true,schedulerEnabled:true});channels.readDeliveryPreferences.mockResolvedValue({emailEnabled:false});channels.getPushState.mockReturnValue('off');channels.registerPush.mockResolvedValue('Connected');sendWelcomeEmail.mockResolvedValue({ok:true,alreadySent:true});});
afterEach(cleanup);
describe('reminder permission onboarding',()=>{
 it('reload while the dialog was still open does not reopen it, even with unavailable storage',async()=>{
  const first=render(<ReminderSetup t={theme} user={user()}/>);await screen.findByRole('dialog');first.unmount();
  const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
  render(<ReminderSetup t={theme} user={user()}/>);
  await waitFor(()=>expect(sendWelcomeEmail).toHaveBeenCalledTimes(2));expect(screen.queryByRole('dialog')).toBeNull();get.mockRestore();
 });

 it('opens only for explicit login; dismissal survives reload and a new login reopens',async()=>{
  const first=render(<ReminderSetup t={theme} user={user()}/>);
  await screen.findByRole('dialog');
  expect(channels.registerPush).not.toHaveBeenCalled();expect(channels.setEmailDelivery).not.toHaveBeenCalled();expect(enableReminders).not.toHaveBeenCalled();
  expect(screen.getByText(/Coming soon/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Not now'}));first.unmount();
  const second=render(<ReminderSetup t={theme} user={user()}/>);
  await waitFor(()=>expect(sendWelcomeEmail).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).toBeNull();second.unmount();
  inviteReminderSetup('u');render(<ReminderSetup t={theme} user={user(2)}/>);await screen.findByRole('dialog');
 });
 it('enables email only after a click and respects saved email preferences',async()=>{
  const view=render(<ReminderSetup t={theme} user={user()}/>);
  const button=await screen.findByRole('button',{name:'Enable email reminders'});
  await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);
  await waitFor(()=>expect(channels.setEmailDelivery).toHaveBeenCalledWith(expect.objectContaining({uid:'u'}),true));
  view.unmount();channels.readDeliveryPreferences.mockResolvedValue({emailEnabled:true});
  inviteReminderSetup('u');render(<ReminderSetup t={theme} user={user(2)}/>);await screen.findByRole('dialog');
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Enable email reminders'})).toBeNull());
 });
 it('requests browser push only through its explicit enable button',async()=>{
  render(<ReminderSetup t={theme} user={user()}/>);
  const button=await screen.findByRole('button',{name:'Enable browser push'});
  await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);
  expect(channels.registerPush).toHaveBeenCalledTimes(1);
  await screen.findByText('Connected');
 });
 it('shows blocked push guidance and a retry for failed welcome email',async()=>{
  channels.getPushState.mockReturnValue('denied');sendWelcomeEmail.mockResolvedValue({ok:false,error:'Try again'});
  render(<ReminderSetup t={theme} user={user()}/>);
  expect((await screen.findByRole('button',{name:'Blocked in browser settings'})).disabled).toBe(true);
  fireEvent.click(await screen.findByRole('button',{name:'Retry welcome email'}));
  await waitFor(()=>expect(sendWelcomeEmail).toHaveBeenCalledTimes(2));
 });
});

import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import AuthExperience from '../src/components/AuthExperience';
import {useT} from '../src/theme';
import {loginWithEmail,registerWithEmail} from '../src/auth';
vi.mock('../src/auth',()=>({loginWithEmail:vi.fn().mockResolvedValue({uid:'test'}),registerWithEmail:vi.fn().mockResolvedValue({uid:'test'}),loginWithGoogle:vi.fn(),requestPasswordResetOTP:vi.fn(),verifyPasswordResetOTP:vi.fn(),confirmPasswordReset:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('keeps login and registration working in the cinematic entry screen',async()=>{
 render(<AuthExperience t={useT('dark','blue')} scheme="blue" setScheme={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('you@example.com'),{target:{value:'test@example.com'}});
 fireEvent.change(screen.getByLabelText('Enter your password'),{target:{value:'Password123'}});
 fireEvent.click(screen.getByRole('button',{name:'Log in',exact:true}));
 await waitFor(()=>expect(loginWithEmail).toHaveBeenCalledWith('test@example.com','Password123'));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Create an account'}).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Create an account'}));
 expect(screen.getByRole('heading',{name:'Begin your next chapter.'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'Sample'}});
 fireEvent.click(screen.getByRole('button',{name:'Create account',exact:true}));
 await waitFor(()=>expect(registerWithEmail).toHaveBeenCalledWith('Sample','test@example.com','Password123'));
});
it('selects the supplied logo and keeps recovery and theme controls accessible',()=>{
 const change=vi.fn();render(<AuthExperience t={useT('dark','peach')} scheme="peach" setScheme={change}/>);
 expect(screen.getByAltText('LIFE OS — Built to Keep You Ahead.').getAttribute('src')).toBe('/brand/lifeos-wordmark-peach.jpg');
 fireEvent.click(screen.getByRole('button',{name:'brown theme'}));expect(change).toHaveBeenCalledWith('brown');
 fireEvent.click(screen.getByRole('button',{name:'Forgot password?'}));
 expect(screen.getByRole('form',{name:'Reset password'})).toBeTruthy();
});

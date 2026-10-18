import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import JournalScreen from '../src/components/JournalScreen';
import {saveTracker,saveJournal,saveOption} from '../src/journal/store';
vi.mock('../src/journal/store',()=>({watchJournal:(_uid,_name,cb)=>{cb([]);return()=>{};},watchPhotos:(_uid,_date,cb)=>{cb({});return()=>{};},saveJournal:vi.fn(),saveOption:vi.fn(),saveTracker:vi.fn(),removeTracker:vi.fn(),compressPhoto:vi.fn(),savePhotos:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('records a missed prayer and preserves journal text on a failed save',async()=>{
 render(<JournalScreen t={{}} user={{uid:'u'}}/>);
 fireEvent.change(screen.getByLabelText('Fajr'),{target:{value:'Not Prayed'}});
 await waitFor(()=>expect(saveTracker).toHaveBeenCalledWith('u',expect.objectContaining({category:'Fajr',behavior:'missed',type:'namaz'})));
 saveJournal.mockRejectedValueOnce(Error('Offline'));
 fireEvent.change(screen.getByLabelText('Your diary'),{target:{value:'My private reflection'}});
 fireEvent.click(screen.getByText('Save journal'));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('Offline'));
 expect(screen.getByLabelText('Your diary').value).toBe('My private reflection');
});
it('saves a custom Namaz status with explicit make-up behavior',async()=>{
 render(<JournalScreen t={{}} user={{uid:'u'}} pluginsOnly/>);
 fireEvent.change(screen.getByLabelText('Option type'),{target:{value:'namaz-status'}});
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Make up later'}});
 fireEvent.change(screen.getByLabelText('What should this status do?'),{target:{value:'missed'}});
 fireEvent.click(screen.getByText('Add option'));
 await waitFor(()=>expect(saveOption).toHaveBeenCalledWith('u',expect.any(String),expect.objectContaining({label:'Make up later',behavior:'missed'})));
});

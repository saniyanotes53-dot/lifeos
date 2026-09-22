import React from 'react';
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import TransactionEditor,{DeleteTransaction} from '../src/components/TransactionEditor';
import StatementImport from '../src/components/StatementImport';
import {addItem,updateItem,deleteItem,importTransactions} from '../src/firestore';
import {readPdfStatement} from '../src/utils/pdf-statement.js';

vi.mock('../src/firestore',()=>({addItem:vi.fn(),updateItem:vi.fn(),deleteItem:vi.fn(),importTransactions:vi.fn()}));
vi.mock('../src/utils/pdf-statement.js',()=>({readPdfStatement:vi.fn()}));
const t={text:'#eee',muted:'#999',line:'#333',surface:'#151b25',surface2:'#202936',a1:'#80b9ff',a3:'#abc',onAccent:'#111',good:'#9d9',warm:'#fbb'};
const user={uid:'test-user'},transaction={id:'real-document-id',date:'2026-09-21',amount:40,type:'expense',category:'Food',note:'Lunch'};
beforeEach(()=>{vi.clearAllMocks();addItem.mockResolvedValue({id:'new'});updateItem.mockResolvedValue();deleteItem.mockResolvedValue();importTransactions.mockResolvedValue({saved:1,skipped:0});});
afterEach(cleanup);

describe('transaction changes',()=>{
 it('edits the chosen document and keeps the form open on permission errors',async()=>{
  const saved=vi.fn(),close=vi.fn();updateItem.mockRejectedValueOnce(Object.assign(Error('Denied'),{code:'permission-denied'}));
  render(<TransactionEditor t={t} userId={user.uid} transaction={transaction} onClose={close} onSaved={saved}/>);
  fireEvent.change(screen.getByLabelText('Transaction amount'),{target:{value:'75.50'}});
  fireEvent.change(screen.getByLabelText('Transaction description'),{target:{value:'Updated lunch'}});
  fireEvent.click(screen.getByText('Save changes'));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Sign in again'));
  expect(close).not.toHaveBeenCalled();expect(addItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Save changes'));
  await waitFor(()=>expect(saved).toHaveBeenCalledWith('Transaction updated.'));
  expect(updateItem).toHaveBeenLastCalledWith('test-user','transactions','real-document-id',expect.objectContaining({amount:75.5,note:'Updated lunch',date:'2026-09-21'}));
 });
 it('requires a delete confirmation and recovers from a failed delete',async()=>{
  const close=vi.fn(),done=vi.fn();deleteItem.mockRejectedValueOnce(Object.assign(Error('Offline'),{code:'unavailable'}));
  render(<DeleteTransaction t={t} userId={user.uid} transaction={transaction} onClose={close} onDeleted={done}/>);
  expect(deleteItem).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Delete transaction'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('offline'));
  expect(done).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Delete transaction'}));
  await waitFor(()=>expect(done).toHaveBeenCalledWith('Transaction deleted.'));expect(deleteItem).toHaveBeenLastCalledWith('test-user','transactions','real-document-id');
 });
});

describe('statement review',()=>{
 it('reads CSV without saving, requires uncertain rows to be corrected and imports only the reviewed selection',async()=>{
  const done=vi.fn();render(<StatementImport t={t} user={user} tx={[]} onClose={()=>{}} onImported={done}/>);
  const file=new File(['sample'],'statement.csv',{type:'text/csv'});file.text=async()=> 'Date,Amount,Type,Description\n21/09/2026,100,expense,Lunch\n22/09/2026,200,,Unclear';
  fireEvent.change(screen.getByLabelText('Statement file'),{target:{files:[file]}});
  fireEvent.click(screen.getByRole('button',{name:'Scan statement'}));
  await waitFor(()=>expect(screen.getByLabelText('Import row 1').checked).toBe(true));
  expect(importTransactions).not.toHaveBeenCalled();expect(screen.getByLabelText('Import row 2').checked).toBe(false);
  fireEvent.click(screen.getByLabelText('Import row 2'));
  expect(screen.getByRole('button',{name:'Import 2 transactions'}).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Type row 2'),{target:{value:'income'}});
  fireEvent.click(screen.getByRole('button',{name:'Import 2 transactions'}));
  await waitFor(()=>expect(done).toHaveBeenCalled());
  expect(importTransactions.mock.calls[0][1].map(row=>row.type)).toEqual(['expense','income']);
 });
 it('routes PDF scanning to the page reader and retains review rows after a save failure',async()=>{
  readPdfStatement.mockResolvedValue({rows:[transaction],warnings:[]});
  importTransactions.mockRejectedValueOnce(Error('Lost connection'));
  render(<StatementImport t={t} user={user} tx={[]} onClose={()=>{}} onImported={()=>{}}/>);
  const file=new File(['%PDF-sample'],'bank.pdf',{type:'application/pdf'});
  fireEvent.change(screen.getByLabelText('Statement file'),{target:{files:[file]}});fireEvent.click(screen.getByRole('button',{name:'Scan statement'}));
  await waitFor(()=>expect(screen.getByLabelText('Import row 1').checked).toBe(true));expect(readPdfStatement).toHaveBeenCalledWith(file,user,expect.any(Function));
  fireEvent.click(screen.getByRole('button',{name:'Import 1 transactions'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('retry safely'));
  expect(screen.getByLabelText('Description row 1').value).toBe('Lunch');expect(screen.getByRole('button',{name:'Import 1 transactions'}).disabled).toBe(false);
 });
 it('marks already imported transactions and allows distinct repeated cash payments after review',async()=>{
  render(<StatementImport t={t} user={user} tx={[]} onClose={()=>{}} onImported={()=>{}}/>);
  const file=new File(['sample'],'cash.csv',{type:'text/csv'});file.text=async()=> 'Date,Amount,Type,Description\n21/09/2026,40,expense,Tea\n21/09/2026,40,expense,Tea';
  fireEvent.change(screen.getByLabelText('Statement file'),{target:{files:[file]}});fireEvent.click(screen.getByRole('button',{name:'Scan statement'}));
  await waitFor(()=>expect(screen.getByLabelText('Import row 2').checked).toBe(false));fireEvent.click(screen.getByLabelText('Import row 2'));
  fireEvent.click(screen.getByRole('button',{name:'Import 2 transactions'}));
  await waitFor(()=>expect(importTransactions).toHaveBeenCalled());const rows=importTransactions.mock.calls[0][1];expect(rows[0].importKey).not.toBe(rows[1].importKey);
 });
});

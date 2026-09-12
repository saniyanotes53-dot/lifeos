import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiModel} from '../server/model.js';
test('model configuration removes accidental terminal punctuation without changing internal version dots',()=>{
 assert.equal(geminiModel(' gemini-3.1-flash-lite. '),'gemini-3.1-flash-lite');
 assert.equal(geminiModel('gemini-3.1-flash-lite'),'gemini-3.1-flash-lite');
 assert.equal(geminiModel('gemini-2.5-flash-lite'),'gemini-2.5-flash-lite');
});

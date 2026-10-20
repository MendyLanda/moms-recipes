import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {passwordMatches,issueToken,validToken,validateRecipe} from '../server/security.js';
test('password comparison rejects incorrect, missing and oversized passwords',()=>{const salt='test-salt';const hash=salt+':'+scryptSync('test-password',salt,64).toString('hex');assert.ok(passwordMatches('test-password',hash));assert.equal(passwordMatches('wrong',hash),false);assert.equal(passwordMatches('test-password',null),false);assert.equal(passwordMatches('x'.repeat(129),hash),false);});
test('session expires and cannot be forged or reused with another secret',()=>{const token=issueToken('test-secret',1000);assert.ok(validToken(token,'test-secret',1001));assert.equal(validToken(token,'other-secret',1001),false);assert.equal(validToken(token+'x','test-secret',1001),false);assert.equal(validToken(token,'test-secret',1000+8*3600_000),false);assert.equal(validToken('', 'test-secret'),false);});
const recipe={id:'test-cake',title:'עוגה',category:'עוגות',type:'פרווה',ingredients:['2 ביצים'],steps:['מערבבים']};
test('recipe validation requires complete structure and safe media/source values',()=>{assert.equal(validateRecipe(recipe).title,'עוגה');for(const change of [{id:'../x'},{ingredients:[]},{steps:['']},{title:''},{type:'bad'},{source:'https://wrong'},{imageUrl:'javascript:alert(1)'},{note:'x'.repeat(4001)}])assert.throws(()=>validateRecipe({...recipe,...change}));assert.equal(validateRecipe({...recipe,unexpected:'ignored'}).unexpected,undefined);});

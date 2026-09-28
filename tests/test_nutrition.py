import unittest
from unittest.mock import patch
from server.nutrition import engine
class NutritionTests(unittest.TestCase):
 def setUp(self):
  engine.CACHE=None
  self.context={'date':'2026-09-28','hour':13,'profile':{'age':25,'medicalStatus':'none','allergies':[],'diet':'vegan','targets':{'protein':80}},'meals':[{'protein':20,'cal':400}],'workouts':[{'minutes':30}],'sleep':[{'hours':7}]}
 def offline(self,*args,**kwargs):raise OSError('offline')
 def test_snapshot_provenance_and_calculation(self):
  p=engine.build_plan(self.context,self.offline)
  self.assertIn('live lookup unavailable',p['source']['kind'])
  self.assertEqual(p['summary']['remainingToUserTargets']['protein'],60)
  self.assertEqual(len(p['plan']),4)
  meal=p['plan'][1]; expected=sum(engine.SNAPSHOT['foods'][k]['nutrients']['protein']*g/100 for k,g in engine.RECIPES[2][3].items())
  self.assertTrue(all(n['fdcId']!=173424 for m in p['alternatives'] for n in m['ingredients']))
  self.assertGreater(meal['nutrients']['protein'],0)
 def test_medical_constraints_block_before_any_network(self):
  for change in [{'age':15},{'medicalStatus':'condition'},{'medicalStatus':'pregnancy'},{'medicalStatus':'eating-disorder'},{'otherAllergies':'banana'},{'age':None}]:
   with self.subTest(change=change):
    c={**self.context,'profile':{**self.context['profile'],**change}}
    self.assertTrue(engine.build_plan(c,lambda *a,**k:self.fail('network called'))['blocked'])
 def test_allergy_filters_cannot_be_overridden_by_ai(self):
  self.context['profile']['allergies']=['eggs','gluten','legumes']
  with patch.dict('os.environ',{'GEMINI_API_KEY':'test'}):
   def fake(url,*a,**k):
    if 'googleapis' in url:return {'candidates':[{'content':{'parts':[{'text':'{"id":"egg_rice"}'}]}}]}
    raise OSError()
   p=engine.build_plan(self.context,fake)
  self.assertEqual(p['nextMeal']['id'],'fruit')
  self.assertNotIn('AI-assisted',p['selection'])
 def test_unknown_nutrients_do_not_become_deficiency_targets(self):
  self.context['meals']=[{'cal':500}]
  p=engine.build_plan(self.context,self.offline)
  self.assertNotIn('protein',p['summary']['remainingToUserTargets'])
 def test_live_data_and_cache_have_explicit_provenance(self):
  def live(url,*a,**kw):
   return [{'fdcId':f['id'],'description':f['description'],'foodNutrients':[{'nutrient':{'id':i},'amount':f['nutrients'][k]} for i,k in engine.NUTRIENTS.items() if k in f['nutrients']]} for f in engine.SNAPSHOT['foods'].values()]
  f,s=engine.nutrition_data(live);self.assertEqual(s['kind'],'live USDA response')
  _,cached=engine.nutrition_data(lambda *a:self.fail('should reuse cache'));self.assertEqual(cached['kind'],'cached USDA response')
  self.assertEqual(f['banana']['nutrients']['cal'],engine.SNAPSHOT['foods']['banana']['nutrients']['cal'])
 def test_ai_sees_only_summary_and_cannot_invent_recipe(self):
  self.context['profile']['email']='private@example.test'
  with patch.dict('os.environ',{'GEMINI_API_KEY':'test'}):
   def fake(url,body=None,*a,**kw):
    if 'googleapis' not in url:raise OSError()
    text=body['contents'][0]['parts'][0]['text'];self.assertNotIn('private@example.test',text)
    return {'candidates':[{'content':{'parts':[{'text':'{"id":"invented"}'}]}}]}
   p=engine.build_plan(self.context,fake)
  self.assertIn(p['nextMeal']['id'],[m['id'] for m in p['alternatives']])
if __name__=='__main__':unittest.main()

class OmnivoreTests(unittest.TestCase):
 def test_meat_and_fish_require_omnivore_and_respect_fish_allergy(self):
  for diet in ['vegan','vegetarian','eggs','omnivore']:
   with self.subTest(diet=diet):
    context={'date':'2026-09-28','hour':12,'profile':{'age':25,'medicalStatus':'none','allergies':['fish'],'diet':diet}}
    result=engine.build_plan(context,lambda *a,**k:(_ for _ in ()).throw(OSError()))
    ids=[r['id'] for r in result['alternatives']]
    self.assertNotIn('salmon_rice',ids)
    self.assertEqual('chicken_rice' in ids,diet=='omnivore')
 def test_missing_setup_identifies_fields_and_does_not_require_logs(self):
  result=engine.build_plan({'profile':{}})
  self.assertTrue(result['needsSetup']);self.assertIn('age and health considerations',result['message'])

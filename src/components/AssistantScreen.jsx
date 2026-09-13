import LocalPlanner from './LocalPlanner';
import React from 'react';
import {Screen,Card} from './primitives';
import AssistantPanel from './AssistantPanel';
export default function AssistantScreen({t,user,...data}){
 return <Screen t={t} title="Life OS Assistant"><Card t={t}><AssistantPanel t={t} user={user} data={data}/><LocalPlanner t={t} user={user} {...data}/></Card></Screen>;
}

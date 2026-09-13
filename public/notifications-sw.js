self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const current=list.find(c=>new URL(c.url).origin===self.location.origin);return current?current.focus():self.clients.openWindow('/?view=timetable');}));});
// Web Push messages are displayed here even when no Life OS tab is open.
self.addEventListener('push',event=>{
 let payload;try{payload=event.data?.json();}catch{return;}
 const data=payload?.data||payload?.notification||payload;if(!data)return;
 event.waitUntil(self.registration.showNotification(data.title||'Life OS reminder',{body:data.body||'A scheduled task is due.',tag:data.tag||'lifeos-reminder',data:{url:'/?view=timetable'}}));
});

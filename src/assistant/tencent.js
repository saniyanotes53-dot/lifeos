import { userRequest } from "./api";
// TencentCloud/TIMSDK's official Web Core SDK; credentials are minted by our server.
export async function connectTencent(user,onReply,onStatus){
  const token=await user.getIdToken();
  const response=await fetch('/api/chat-session',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
  const session=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(session.error||'Cloud chat is unavailable. Use the built-in planner.');
  const {default:TencentChat}=await import('@tencentcloud/chat');
  const history=[];
  const chat=TencentChat.create({SDKAppID:session.sdkAppId});chat.setLogLevel(2);
  const receive=event=>{for(const message of event.data||[])if(message.from===session.botUserId&&message.type===TencentChat.TYPES.MSG_TEXT){history.push({role:"assistant",text:message.payload.text.slice(0,4000)});onReply(message.payload.text,message.ID);}};
  const kicked=()=>onStatus('Disconnected. Reconnect to continue cloud chat.');
  chat.on(TencentChat.EVENT.MESSAGE_RECEIVED,receive);chat.on(TencentChat.EVENT.KICKED_OUT,kicked);
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{chat.off(TencentChat.EVENT.SDK_READY,ready);reject(new Error('Chat connection timed out.'));},20000);
      const ready=()=>{clearTimeout(timer);chat.off(TencentChat.EVENT.SDK_READY,ready);resolve();};
      chat.on(TencentChat.EVENT.SDK_READY,ready);
      chat.login({userID:session.userId,userSig:session.userSig}).catch(error=>{clearTimeout(timer);chat.off(TencentChat.EVENT.SDK_READY,ready);reject(error);});
    });
  }catch(error){await chat.destroy();throw error;}
  return {
    async send(text){const message=chat.createTextMessage({to:session.botUserId,conversationType:TencentChat.TYPES.CONV_C2C,payload:{text}});await chat.sendMessage(message);
      const previous=history.slice(-12);history.push({role:"user",text});
      await userRequest(user,"/api/bot-reply","POST",{text,history:previous});},
    async close(){chat.off(TencentChat.EVENT.MESSAGE_RECEIVED,receive);chat.off(TencentChat.EVENT.KICKED_OUT,kicked);await chat.destroy();}
  };
}

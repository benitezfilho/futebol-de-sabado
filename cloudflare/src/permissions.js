// PeladaPro V10: permissões aplicadas no servidor, nunca somente nos menus.
export const ROLES=Object.freeze(["member","admin","master"]);
export const PERMISSIONS=Object.freeze({
  member: Object.freeze(["matches:read","account:self"]),
  admin: Object.freeze(["matches:read","account:self","operations:read"]),
  master: Object.freeze(["matches:read","account:self","operations:read","security:read"])
});
export function hasPermission(role,permission){
  return Object.hasOwn(PERMISSIONS,role)&&PERMISSIONS[role].includes(permission);
}
export function authorize(account,permission){
  if(!account)return {ok:false,status:401,error:"Autenticação necessária"};
  if(!account.active)return {ok:false,status:403,error:"Conta desativada"};
  if(!hasPermission(account.role,permission))return {ok:false,status:403,error:"Acesso não autorizado"};
  return {ok:true};
}

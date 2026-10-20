export function validateRuntimeConfig() {
  if(process.env.NODE_ENV!=="production")return;
  for(const key of ["DATABASE_URL","APP_URL","AUTH_SECRET","FLAG_SECRET","SMTP_URL","MAIL_FROM"]){
    if(!process.env[key])throw new Error(`${key} is required in production.`);
  }
  const appUrl=new URL(process.env.APP_URL!);
  if(appUrl.protocol!=="https:"||appUrl.pathname!=="/"||appUrl.username||appUrl.password)throw new Error("APP_URL must be an HTTPS origin in production.");
  for(const key of ["AUTH_SECRET","FLAG_SECRET"])if(process.env[key]!.length<32)throw new Error(`${key} must contain at least 32 characters.`);
  if(process.env.AUTH_SECRET===process.env.FLAG_SECRET)throw new Error("AUTH_SECRET and FLAG_SECRET must be different.");
  if(!["postgres:","postgresql:"].includes(new URL(process.env.DATABASE_URL!).protocol))throw new Error("DATABASE_URL must point to PostgreSQL.");
  if(process.env.LOCAL_MAIL==="1")throw new Error("The local development mailbox must be disabled in production.");
}

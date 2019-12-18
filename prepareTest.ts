import fs from "fs";

if (process.env.service_account) {
    fs.writeFileSync("./datastoreServiceAccount.json", process.env.service_account);
} else {
    throw Error("process.env.service_account not set");
}

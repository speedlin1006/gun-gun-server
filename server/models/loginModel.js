import mongoose from "mongoose"

const loginSchema = new mongoose.Schema({
  account: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  guild: { type: String, required: true },
  role: { type: String, required: true }
})


const Login = mongoose.model("logins", loginSchema)

export default Login

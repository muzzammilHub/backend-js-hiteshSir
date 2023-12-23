import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";


const verifyJwt = asyncHandler(async(req, _, next)=>{

    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        if(!token){
            throw new ApiError(401, "token not found")
        }
    
        const decoded_token = jwt.verify(token, process.env.ACCESS_SECRET_TOKEN)
    
        const user = await User.findById(decoded_token?._id)
    
        if(!user){
            // todo: disscuss about frontend
            throw new ApiError(401, "Invalid access token")
        }
    
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(
            400,
            error?.message || "invalid access token"
        )
    }
})

export { verifyJwt }
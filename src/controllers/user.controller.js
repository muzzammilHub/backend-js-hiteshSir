import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"


const registerUser = asyncHandler( async(req, res) => {

    const { username, fullName, email, password } = req.body;

    if(
        [username, fullName, email, password].some( (field) => 
        field?.trim() === ""
        )
    ){
        throw new ApiError(400, "all fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })

    if(existedUser){
        throw new ApiError(409, "User with username or email already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    console.log("avatar: ", avatarLocalPath);
    console.log("cover_image: ", coverImageLocalPath);

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file not uploaded successfully to cloudinary")
    }

    const user = await User.create({
        fullName,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" 
    )

    if(!createdUser){
        throw new ApiError(500, "Issue in created the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully!")
    )

})


const generateAccessAndRefreshTokens = async (userId)=>{
    try {
        
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "something went wrong during generating access and refresh token")
    }
}

const loginUser = async(req, res) => {

    try {
        

        const {email, username, password} = req.body
        console.log(email);
    
        if (!username && !email) {
            throw new ApiError(400, "username or email is required")
        }
    
        const user = await User.findOne({
            $or: [{username}, {email}]
        })
    
        console.log(user)

        if (!user) {
            throw new ApiError(404, "User does not exist")
        }
    
       const isPasswordValid = await user.isPasswordCorrect(password)
    
       if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
        }
    
       const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const logoutUser = asyncHandler(async(req, res)=>{

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, "user logout successfully"))
})

const refreshAccessToken = async(req, res)=>{
    try {
        
        const incommingRefreshToken = req.cookie?.refreshToken || req.body.refreshToken

        if(!incommingRefreshToken){
            throw new ApiError(401, "Invalid request")
        }

        const decoded_token = jwt.verify(incommingRefreshToken, REFRESH_SECRET_TOKEN)

        const user = await User.findById(decoded_token._id)

        if(!user){
            throw new ApiError(401, "unauthorized access")
        }

        if(incommingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "refresh token expired")
        }

        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

        const options = {
            httpOnly: true,
            secure: only
        }

        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(201, {
            accessToken,
            refreshToken
        }, "access-token refreshed"))


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error?.message
        })
    }
}

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}
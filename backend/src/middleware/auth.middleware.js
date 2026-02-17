import {supabase} from '../config/supabase.js';

export const verifyUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({message: 'Unauthorized, token missing'});
    }

    const {data,error} = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        return res.status(401).json({message: 'Unauthorized, invalid token'});
    }  
    
    req.user = data.user;
    next();
};

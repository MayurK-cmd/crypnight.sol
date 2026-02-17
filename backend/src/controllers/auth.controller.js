import {supabase} from '../config/supabase.js';

export const signup = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters long',
    });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  console.log("Supabase signup error:", error);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // 🔥 VERY IMPORTANT: create game profile row
  const { error: insertError } = await supabase
    .from("users")
    .insert({
      id: data.user.id,
      wallet_address: null,
      tier: null,
      rating: 1000,
    });

  console.log("Insert error:", insertError);

  if (insertError) {
    return res.status(500).json({
      error: "User created but profile creation failed",
    });
  }

  return res.status(201).json({
    message: "User registered successfully",
    user: data.user,
    session: data.session,
  });
};



export const login = async (req, res) => {
    const {email, password} = req.body;

    if(!email || !password) {
        return res.status(400).json({error: 'Email and password are required'});
    }

    const {data, error} = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    
    if (error) {
        if(error.message.includes('Invalid login credentials')) {
            return res.status(401).json({error: 'Invalid email or password'});
        }

        if(error.message.includes('Email not confirmed')) {
            return res.status(403).json({error: 'Email not confirmed. Please check your inbox.'});
        }

        return res.status(400).json({error: error.message});
       
    }

    return res.status(200).json({
        message: 'User logged in successfully', 
        user: data.user,
        session: data.session
    });
};
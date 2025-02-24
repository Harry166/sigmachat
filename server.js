require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Multer configuration
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = verified.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Auth routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username',
            [username, email, hashedPassword]
        );

        const token = jwt.sign(
            { userId: result.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, username: result.rows[0].username });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Posts routes
app.post('/api/posts', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const result = await pool.query(
            'INSERT INTO posts (author_id, content, image) VALUES ($1, $2, $3) RETURNING *',
            [req.userId, req.body.content, req.file?.filename]
        );

        const post = result.rows[0];
        const userResult = await pool.query(
            'SELECT username, avatar FROM users WHERE id = $1',
            [req.userId]
        );

        post.author = userResult.rows[0];
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Error creating post' });
    }
});

app.get('/api/posts', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username, u.avatar, 
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
                   (SELECT COUNT(*) FROM resigmas WHERE post_id = p.id) as resigma_count
            FROM posts p
            JOIN users u ON p.author_id = u.id
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching posts' });
    }
});

// Profile routes
app.get('/api/users/:userId', verifyToken, async (req, res) => {
    try {
        const userId = req.params.userId === 'me' ? req.userId : req.params.userId;
        const result = await pool.query(`
            SELECT id, username, email, avatar, bio, cover_image,
                   (SELECT COUNT(*) FROM followers WHERE following_id = users.id) as followers_count,
                   (SELECT COUNT(*) FROM followers WHERE follower_id = users.id) as following_count
            FROM users 
            WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user' });
    }
});

// Like/Unlike
app.post('/api/posts/:postId/like', verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const checkLike = await pool.query(
            'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
            [req.userId, postId]
        );

        if (checkLike.rows.length === 0) {
            await pool.query(
                'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
                [req.userId, postId]
            );
            res.json({ message: 'Post liked' });
        } else {
            await pool.query(
                'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
                [req.userId, postId]
            );
            res.json({ message: 'Post unliked' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error updating like' });
    }
});

// Resigma
app.post('/api/posts/:postId/resigma', verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const checkResigma = await pool.query(
            'SELECT * FROM resigmas WHERE user_id = $1 AND post_id = $2',
            [req.userId, postId]
        );

        if (checkResigma.rows.length === 0) {
            await pool.query(
                'INSERT INTO resigmas (user_id, post_id) VALUES ($1, $2)',
                [req.userId, postId]
            );
            res.json({ message: 'Post resigma\'d' });
        } else {
            await pool.query(
                'DELETE FROM resigmas WHERE user_id = $1 AND post_id = $2',
                [req.userId, postId]
            );
            res.json({ message: 'Post un-resigma\'d' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error updating resigma' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
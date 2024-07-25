const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const dynamo = new AWS.DynamoDB.DocumentClient();
const USER_TABLE = 'UsersTable';
const SECRET_KEY = 'your_secret_key';
const TOKEN_EXPIRATION = '1h';

exports.handler = async (event) => {
    const { httpMethod, path } = event;

    if (httpMethod === 'POST' && path === '/signup') {
        return await handleSignup(event);
    } else if (httpMethod === 'POST' && path === '/login') {
        return await handleLogin(event);
    } else if (httpMethod === 'POST' && path === '/forget-password') {
        return await handleForgetPassword(event);
    } else {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Route not found' }),
        };
    }
};

async function handleSignup(event) {
    const { username, password } = JSON.parse(event.body);
    const hashedPassword = await bcrypt.hash(password, 10);

    const params = {
        TableName: USER_TABLE,
        Item: {
            username,
            password: hashedPassword,
        },
    };

    await dynamo.put(params).promise();

    return {
        statusCode: 201,
        body: JSON.stringify({ message: 'User created successfully' }),
    };
}

async function handleLogin(event) {
    const { username, password } = JSON.parse(event.body);

    const params = {
        TableName: USER_TABLE,
        Key: { username },
    };

    const result = await dynamo.get(params).promise();

    if (!result.Item || !await bcrypt.compare(password, result.Item.password)) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Invalid username or password' }),
        };
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: TOKEN_EXPIRATION });
    const cookieToken = cookie.serialize('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 60 * 60, // 1 hour
    });

    return {
        statusCode: 200,
        headers: {
            'Set-Cookie': cookieToken,
        },
        body: JSON.stringify({ message: 'Login successful' }),
    };
}

async function handleForgetPassword(event) {
    // Implement your forget password logic here (e.g., send reset link via email)
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Forget password functionality not implemented' }),
    };
}

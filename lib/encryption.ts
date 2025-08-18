import crypto from 'crypto'

// Use environment variable for encryption key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!'
const IV_LENGTH = 16 // For AES, this is always 16

// Ensure the key is 32 bytes
const getKey = () => {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  return key
}

export async function encrypt(text: string): Promise<string> {
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      getKey(),
      iv
    )
    
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    return iv.toString('hex') + ':' + encrypted.toString('hex')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

export async function decrypt(text: string): Promise<string> {
  try {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      getKey(),
      iv
    )
    
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString()
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}
const crypto = require('crypto')

// Test decryption function
function testDecrypt() {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '274395287d6577f45687805b1b1c5cccffbb0a4b4d26258fef1502b94cd984cf'
  
  console.log('Using ENCRYPTION_KEY:', ENCRYPTION_KEY)
  console.log('Key length:', ENCRYPTION_KEY.length)
  
  // Create key by hashing
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  console.log('Hashed key (hex):', key.toString('hex'))
  console.log('Hashed key length:', key.length)
  
  // Test encryption/decryption
  try {
    const testText = 'test-password-123'
    console.log('\nTesting encryption/decryption with:', testText)
    
    // Encrypt
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(testText)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    const encryptedString = iv.toString('hex') + ':' + encrypted.toString('hex')
    console.log('Encrypted:', encryptedString)
    
    // Decrypt
    const textParts = encryptedString.split(':')
    const decryptIv = Buffer.from(textParts[0], 'hex')
    const encryptedText = Buffer.from(textParts[1], 'hex')
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, decryptIv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    console.log('Decrypted:', decrypted.toString())
    console.log('Success: Encryption/Decryption works!')
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testDecrypt()
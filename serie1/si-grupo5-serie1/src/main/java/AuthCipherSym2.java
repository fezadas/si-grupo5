import javax.crypto.*;
import javax.crypto.spec.DESKeySpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.file.Files;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.KeySpec;
import java.util.Arrays;

public class AuthCipherSym2 {

    private static Cipher cipher;
    private static Mac mac;
    private static String file;
    private static String password;

    public static void main(String[] args) throws Exception {

        cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        mac = Mac.getInstance("HmacSHA1");
        file = args[1];
        password = args[2];

        switch (args[0]){
            case "-cipher": cipher(); break;
            case "-decipher": decipher(); break;
            default: System.out.println("Invalid command."); break;
        }
    }

    //-cipher serie1-1819i-v2.1.pdf pwd
    private static void cipher() throws Exception {

        byte[] salt = new byte[8];
        new SecureRandom().nextBytes(salt);
        SecretKeySpec skey = generateSecretKeySpec(salt);

        cipher.init(Cipher.ENCRYPT_MODE, skey);

        String fileName = file.substring(0, file.lastIndexOf('.')) + "_ciphered"
                + file.substring(file.lastIndexOf('.'), file.length());
        String auxName = "auxCipher";

        FileOutputStream out = new FileOutputStream(new File(auxName));
        FileInputStream in = new FileInputStream(file);
        byte[] block = new byte[8]; //DES block size = 8 bytes
        while ((in.read(block)) != -1) {
            out.write(cipher.update(block));
        }
        out.write(cipher.doFinal());
        out.close();
        in.close();

        //ciphered-file + tag + iv
        out = new FileOutputStream(fileName);

        mac.init(skey);

        FileInputStream fileInputStream = new FileInputStream(new File(auxName));
        updateInBlocks(fileInputStream,mac);
        fileInputStream.close();

        out.write(salt); //salt = 8 bytes

        out.write(mac.doFinal()); //tag = 20 bytes

        out.write(cipher.getIV()); //iv = 16 bytes

        writeInFile(auxName,out);
        out.close();
    }

    //-decipher serie1-1819i-v2.1_ciphered.pdf pwd
    private static void decipher() throws Exception {

        FileInputStream is = new FileInputStream(file);
        byte[] salt = new byte[8];
        is.read(salt);
        byte[] tag = new byte[20];
        is.read(tag);
        byte[] iv = new byte[16];
        is.read(iv);

        SecretKeySpec skey = generateSecretKeySpec(salt);

        // Verification

        mac.init(skey);
        updateInBlocks(is,mac);
        byte[] cTag = mac.doFinal();
        System.out.println(Arrays.equals(tag, cTag) ? "Valid Authentication" : "Invalid Authentication");
        is.close();

        // Decryption

        is = new FileInputStream(file);
        is.read(new byte[28]);
        cipher.init(Cipher.DECRYPT_MODE, skey, new IvParameterSpec(iv));

        String decFile = file.substring(0, file.indexOf("_ciphered"))
                + "_deciphered"
                + file.substring(file.lastIndexOf('.'), file.length());
        FileOutputStream os = new FileOutputStream(decFile);
        byte[] bytes = new byte[8];
        while (is.read(bytes) != -1) {
            os.write(cipher.update(bytes));
        }
        os.write(cipher.doFinal());
        os.close();
    }

    private static SecretKeySpec generateSecretKeySpec(byte[] salt) throws NoSuchAlgorithmException, InvalidKeySpecException {
        SecretKeyFactory factory =
                SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");
        KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 10000, 128);
        SecretKey tmp = factory.generateSecret(spec);
        return new SecretKeySpec(tmp.getEncoded(), "AES");
    }

    private static void updateInBlocks (FileInputStream fileInputStream, Mac mac) throws Exception {
        byte[] block = new byte[1024];
        int read;
        while((read =fileInputStream.read(block))!=-1){
            mac.update(block,0 ,read);
        }
    }

    private static void writeInFile (String fileName, OutputStream out) throws Exception {
        FileInputStream fileInputStream = new FileInputStream(new File(fileName));
        byte[] block = new byte[1024];
        int read;
        while((read =fileInputStream.read(block))!=-1){
            out.write(block,0,read);
        }
        fileInputStream.close();
    }
}
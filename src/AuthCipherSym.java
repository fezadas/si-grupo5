import javax.crypto.*;
import javax.crypto.spec.DESKeySpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.file.Files;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;

public class AuthCipherSym {

    public static void main(String[] args) throws Exception {

        byte[] keyBytes = Files.readAllBytes(new File(args[2]).toPath());
        Cipher cipher = Cipher.getInstance("DES/CBC/PKCS5Padding");
        SecretKey key = getDesKey(keyBytes);

        switch (args[0]){
            case "-cipher": cipher(cipher, key, keyBytes, args[1]); break;
            case "-decipher": decipher(cipher, keyBytes, args[1]); break;
            default: System.out.println("Invalid command."); break;
        }
    }

    //-cipher serie1-1819i-v2.pdf key.txt
    private static void cipher(Cipher cipher, SecretKey desKey, byte[] keyBytes, String fileName) throws Exception {

        cipher.init(Cipher.ENCRYPT_MODE, desKey,new IvParameterSpec(new byte[]{1,2,3,4,0,0,0,2}));

        String fileNameWithoutExtention = fileName.substring(0, fileName.lastIndexOf('.')),
                fileExtention = fileName.substring(fileName.lastIndexOf('.'), fileName.length());

        String auxCipheredFileName = fileNameWithoutExtention + "-c" + fileExtention;

        FileOutputStream fileOutputStream =
                new FileOutputStream(new File(auxCipheredFileName));
        FileInputStream fileInputStream = new FileInputStream(new File(fileName));
        byte[] block = new byte[8]; //DES block size = 64 bytes
        while ((fileInputStream.read(block)) != -1) {
            fileOutputStream.write(cipher.update(block));
        }
        fileOutputStream.write(cipher.doFinal());
        fileOutputStream.flush();
        fileOutputStream.close();

        //------------------------------------------

        byte[] cipheredFile =
                Files.readAllBytes(new File(auxCipheredFileName).toPath());

        FileOutputStream finalFileOutStream =
                new FileOutputStream(fileNameWithoutExtention + "_ciphered" + fileExtention);

        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA1");
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(key);
        /*
        ByteArrayInputStream in = new ByteArrayInputStream(cipheredFile);
        byte[] ibuf = new byte[20];
        int len;
        while ((len = in.read(ibuf)) != -1) {
            mac.update(ibuf, 0, len);
            finalFileOutStream.write(ibuf);
        }*/


        byte[] iv = cipher.getIV();
        byte[] tag = (mac.doFinal(cipheredFile));
        finalFileOutStream.write(tag); //tag = 20 bytes
        finalFileOutStream.write(iv); //iv = 8 bytes

        //------------------------------------------

        finalFileOutStream.write(cipheredFile);
        finalFileOutStream.close();
    }

    //-decipher serie1-1819i-v2_ciphered.pdf key.txt
    private static void decipher(Cipher cipher, byte[] keyBytes, String fileName) throws Exception {


        FileInputStream is = new FileInputStream(new File(fileName));
        byte[] tag = new byte[20]; //tag
        is.read(tag);

        byte[] iv = new byte[8]; //iv
        is.read(iv);

        cipher.init(Cipher.DECRYPT_MODE, getDesKey(keyBytes), new IvParameterSpec(iv));

        String finalFileName = "final_decipher" +fileName.substring(fileName.lastIndexOf('.'), fileName.length());

        FileOutputStream os = new FileOutputStream(finalFileName);
        byte[] bytes = new byte[8];
        while (is.read(bytes) != -1) {
            os.write(cipher.update(bytes));
        }
        os.write(cipher.doFinal(bytes));
        os.close();

        //verificação
    }

    private static SecretKey getDesKey(byte[] keyBytes) throws Exception{
        DESKeySpec keySpec = new DESKeySpec(keyBytes);
        return SecretKeyFactory.getInstance("DES")
                .generateSecret(keySpec); //key = 8 bytes
    }
}

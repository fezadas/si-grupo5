import javax.crypto.*;
import javax.crypto.spec.DESKeySpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.file.Files;
import java.util.Arrays;

public class AuthCipherSym {

    private static Cipher cipher;
    private static Mac mac;
    private static SecretKey desKey, key;
    private static String file;

    public static void main(String[] args) throws Exception {

        cipher = Cipher.getInstance("DES/CBC/PKCS5Padding");
        mac = Mac.getInstance("HmacSHA1");
        file = args[1];

        byte[] keyBytes = Files.readAllBytes(new File(args[2]).toPath());
        key = new SecretKeySpec(keyBytes, "HmacSHA1");
        desKey = SecretKeyFactory.getInstance("DES")
                .generateSecret(new DESKeySpec(keyBytes)); //key = 8 bytes

        switch (args[0]){
            case "-cipher": cipher(); break;
            case "-decipher": decipher(); break;
            default: System.out.println("Invalid command."); break;
        }
    }

    //-cipher serie1-1819i-v2.1.pdf key.txt
    private static void cipher() throws Exception {

        cipher.init(Cipher.ENCRYPT_MODE, desKey);

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

        mac.init(key);

        FileInputStream fileInputStream = new FileInputStream(new File(auxName));
        updateInBlocks(fileInputStream,mac);
        fileInputStream.close();

        out.write(mac.doFinal()); //tag = 20 bytes

        out.write(cipher.getIV()); //iv = 8 bytes

        writeInFile(auxName,out);
        out.close();
    }

    //-decipher serie1-1819i-v2.1_ciphered.pdf key.txt
    private static void decipher() throws Exception {

        FileInputStream is = new FileInputStream(file);
        byte[] tag = new byte[20];
        is.read(tag);
        byte[] iv = new byte[8];
        is.read(iv);

        // Verification

        mac.init(key);
        updateInBlocks(is,mac);
        byte[] cTag = mac.doFinal();
        System.out.println(Arrays.equals(tag, cTag) ? "Valid Authentication" : "Invalid Authentication");
        is.close();

        // Decryption

        is = new FileInputStream(file);
        is.read(new byte[28]);
        cipher.init(Cipher.DECRYPT_MODE, desKey, new IvParameterSpec(iv));

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
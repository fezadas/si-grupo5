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

    //-cipher serie1-1819i-v2.pdf key.txt
    private static void cipher() throws Exception {

        cipher.init(Cipher.ENCRYPT_MODE, desKey);

        String fileName = file.substring(0, file.lastIndexOf('.')) + "_ciphered"
                + file.substring(file.lastIndexOf('.'), file.length());

        FileOutputStream out = new FileOutputStream(new File(fileName));
        FileInputStream in = new FileInputStream(file);
        byte[] block = new byte[8]; //DES block size = 8 bytes
        while ((in.read(block)) != -1) {
            out.write(cipher.update(block));
        }
        out.write(cipher.doFinal());
        out.flush();
        out.close();

        byte[] cipheredFile = Files.readAllBytes(new File(fileName).toPath());

        //ciphered-file + tag + iv
        out = new FileOutputStream(fileName);

        mac.init(key);
        out.write(mac.doFinal(cipheredFile)); //tag = 20 bytes

        out.write(cipher.getIV()); //iv = 8 bytes
        out.write(cipheredFile);
        out.close();
    }

    //-decipher serie1-1819i-v2_ciphered.pdf key.txt
    private static void decipher() throws Exception {

        FileInputStream is = new FileInputStream(file);
        byte[] tag = new byte[20];
        is.read(tag);
        byte[] iv = new byte[8];
        is.read(iv);

        // Verification

        byte[] cipheredFile = Files.readAllBytes(new File(file).toPath());
        cipheredFile = Arrays.copyOfRange(cipheredFile, 28, cipheredFile.length); //remove tag and iv

        mac.init(key);
        byte[] cTag = mac.doFinal(cipheredFile);
        System.out.println(Arrays.equals(tag, cTag) ? "V" : "F");

        // Decryption

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
}
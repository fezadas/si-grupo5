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

        String fileName = file.substring(0, file.lastIndexOf('.')),
                extension = file.substring(file.lastIndexOf('.'), file.length()),
                auxCipheredFile = "c" + extension;

        FileOutputStream out = new FileOutputStream(new File(auxCipheredFile));
        FileInputStream in = new FileInputStream(file);
        byte[] block = new byte[8]; //DES block size = 64 bytes
        while ((in.read(block)) != -1) {
            out.write(cipher.update(block));
        }
        out.write(cipher.doFinal());
        out.flush();
        out.close();

        byte[] cipheredFile = Files.readAllBytes(new File(auxCipheredFile).toPath());

        //ciphered-file + tag + iv
        out = new FileOutputStream(fileName + "_ciphered" + extension);

        mac.init(key);
        out.write(mac.doFinal(cipheredFile)); //tag = 20 bytes

        out.write(cipher.getIV()); //iv = 8 bytes
        out.write(cipheredFile);
        out.close();
    }

    //-decipher serie1-1819i-v2_ciphered.pdf key.txt
    private static void decipher() throws Exception {

        FileInputStream is = new FileInputStream(file);
        byte[] tag = new byte[20]; //tag
        is.read(tag);

        //FIXME: errado. verificação corrigir !!
        /*
        mac.init(key);
        byte[] cTag = mac.doFinal(Files.readAllBytes(new File(file).toPath()));
        if (Arrays.equals(tag, cTag)) {
            System.out.println("V");
        } else {
            System.out.println("F");
        }
        */

        byte[] iv = new byte[8]; //iv
        is.read(iv);
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
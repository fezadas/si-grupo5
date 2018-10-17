import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.security.*;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;

public class AssinDigitalRSA {

    private static String file;
    private static String hash;
    private static byte[] data;

    private static final String CERT_DIR = "certs/";
    private static final String KEYS_DIR = "keys/";

    public static void main(String[] args) throws Exception {

        hash = args[1].equals("-sha1") ? "SHA1withRSA" : "SHA256withRSA";
        file = args[2];
        data = Files.readAllBytes(new File(file).toPath());

        switch (args[0]){
            case "-sign": sign(args[3], args[4]); break;
            case "-verify": verify(args[3], args[4]); break;
            default: System.out.println("Invalid command."); break;
        }
    }

    //-sign -sha256 serie1-1819i-v2.1.pdf Alice_1.pfx changeit
    //-sign -sha256 serie1-1819i-v2.1.pdf Bob_1.pfx changeit
    private static void sign(String keyFile, String password) throws Exception {

        Signature signature = Signature.getInstance(hash);
        signature.initSign(getPrivateKeyFromPfx(keyFile, password));
        signature.update(data);
        byte[] sign = signature.sign();
        FileOutputStream outputStream =
                new FileOutputStream(new File(file.substring(0, file.lastIndexOf('.')) + ".sign"));
        outputStream.write(sign);
        outputStream.close();
    }

    //-verify -sha256 serie1-1819i-v2.1.pdf serie1-1819i-v2.1.sign Alice_1.cer
    //-verify -sha256 serie1-1819i-v2.1.pdf serie1-1819i-v2.1.sign Bob_1.cer
    private static void verify(String signedFile, String cert) throws Exception {

        CertificateFactory certificateFact = CertificateFactory.getInstance("X.509");
        FileInputStream in = new FileInputStream(CERT_DIR + cert);
        X509Certificate cer = (X509Certificate) certificateFact.generateCertificate(in);
        in.close();

        PublicKey key = cer.getPublicKey();
        Signature verification = Signature.getInstance(hash);
        verification.initVerify(key);

        byte[] dataSigned = Files.readAllBytes(new File(signedFile).toPath());
        verification.update(data);

        System.out.println(verification.verify(dataSigned) ? "Valid Signature" : "Invalid Signature");
    }

    private static PrivateKey getPrivateKeyFromPfx(String keyFile, String password) throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException, UnrecoverableKeyException {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream fin = new FileInputStream(KEYS_DIR + keyFile)) {
            ks.load(fin, password.toCharArray());
            return (PrivateKey) ks.getKey(ks.aliases().nextElement(), password.toCharArray());
        }
    }
}

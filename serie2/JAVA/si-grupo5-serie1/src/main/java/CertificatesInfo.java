
import javax.net.ssl.*;

import java.security.cert.*;

public class CertificatesInfo {

    public static void main(String[] args) throws Exception {
        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();

        String[] supportedCS = factory.getSupportedCipherSuites();
        for (String cs : supportedCS) {
            System.out.println(cs);
        }

        SSLSocket socket = (SSLSocket) factory.createSocket("www.google.pt", 443);
        socket.startHandshake();

        SSLSession session = socket.getSession();
        Certificate[] certificates = session.getPeerCertificates();

        for (Certificate cert : certificates) {
            if(cert instanceof X509Certificate) {
                X509Certificate x = (X509Certificate ) cert;
                System.out.println(x.getSubjectDN().getName());
                System.out.println("Expiration date: " + x.getNotAfter());
                System.out.println();
            }
        }
        System.out.println("Selected protocol: "+ session.getProtocol());
        socket.close();
    }
}



import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.SocketException;
import java.time.Instant;
import java.util.Calendar;
import java.util.Date;

import javax.net.ssl.*;

import org.omg.CORBA.portable.OutputStream;

import java.security.cert.*;

public class CerticatesInfo {

    public static void main(String[] args) throws Exception {
        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();

        /*String[] supportedCS = factory.getSupportedCipherSuites();
        for (String cs : supportedCS) {
            System.out.println(cs);
        }*/

        SSLSocket socket = (SSLSocket) factory.createSocket("www.isel.pt", 443);
        socket.startHandshake();

        SSLSession session = socket.getSession();
        Certificate[] certificates = session.getPeerCertificates();

        for (Certificate cert:certificates) {
            if(cert instanceof X509Certificate) {
                X509Certificate x = (X509Certificate ) cert;
                System.out.println(x.t());
        }

        System.out.println("Selected protocol: "+ session.getProtocol());
        System.out.println("Seected cipher suite: " + session.getCipherSuite());

        socket.close();
    }
}
}



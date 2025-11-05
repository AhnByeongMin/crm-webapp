"""
자체 서명 SSL 인증서 생성 스크립트
내부망에서 HTTPS를 사용하기 위한 인증서를 만듭니다.
"""

from OpenSSL import crypto
import os

def generate_self_signed_cert():
    # 키 생성
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, 2048)

    # 인증서 생성
    cert = crypto.X509()
    cert.get_subject().C = "KR"
    cert.get_subject().ST = "Seoul"
    cert.get_subject().L = "Seoul"
    cert.get_subject().O = "Internal Network"
    cert.get_subject().OU = "CRM System"
    cert.get_subject().CN = "172.31.13.55"

    # SAN (Subject Alternative Names) 추가 - 중요!
    cert.add_extensions([
        crypto.X509Extension(b"subjectAltName", False,
            b"IP:172.31.13.55,IP:127.0.0.1,DNS:localhost")
    ])

    cert.set_serial_number(1000)
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(365*24*60*60)  # 1년 유효
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(k)
    cert.sign(k, 'sha256')

    # 파일로 저장
    with open("cert.pem", "wb") as f:
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))

    with open("key.pem", "wb") as f:
        f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, k))

    print("✅ SSL 인증서 생성 완료!")
    print("   - cert.pem (인증서)")
    print("   - key.pem (개인키)")
    print("\n이제 HTTPS로 서버를 실행할 수 있습니다.")

if __name__ == "__main__":
    # pyOpenSSL이 설치되어 있는지 확인
    try:
        generate_self_signed_cert()
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        print("\npyOpenSSL이 필요합니다. 설치 중...")
        import subprocess
        subprocess.check_call(['pip', 'install', 'pyOpenSSL'])
        print("\n다시 실행합니다...")
        generate_self_signed_cert()

export interface SchoolGeoEntry {
  instituicao: string;
  logradouro: string;
  bairro: string;
  cep: string;
  cidade: string;
  latitude: number;
  longitude: number;
}

export const OFFICIAL_SCHOOL_GEO_LIST: SchoolGeoEntry[] = [
  // PIEDADE (18170000)
  { instituicao: 'CEMEI ANTONIO ROLIM DA SILVA', logradouro: 'RUA PETROLANDIA 50', bairro: 'CENTRO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7175285, longitude: -47.4111533 },
  { instituicao: 'CEMEI PROFA LEDA FREIRE GOMES', logradouro: 'RUA FRANCISCO ANTONIO CORREA 481', bairro: 'PARQUE DA TORRE', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7173406, longitude: -47.4100433 },
  { instituicao: 'CEMEI SYLVINO SANTOS NETTO', logradouro: 'RUA SAO BARTOLOMEU S N', bairro: 'JARDIM SAO BARTOLOMEU', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7054793, longitude: -47.4245401 },
  { instituicao: 'COLEGIO MONTEIRO LOBATO - ANGLO', logradouro: 'RUA CHOSAKO NOHAMA 431', bairro: 'CECAP', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7196281, longitude: -47.4075457 },
  { instituicao: 'COLEGIO OBJETIVO PIEDADE', logradouro: 'R. BENJAMIN CONSTANT 81', bairro: 'CENTRO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7144379, longitude: -47.4159079 },
  { instituicao: 'EE. PROF. CARLOS AUGUSTO DE CAMARGO', logradouro: 'RUA VICENTE GARCIA N 296', bairro: 'CENTRO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7159283, longitude: -47.4187185 },
  { instituicao: 'EE. PROFA MARIA PAULA RAMALHO PAES', logradouro: 'FRANCISCO ANTONIO CORREA', bairro: 'PARQUE DA TORRE', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7181123, longitude: -47.4095663 },
  { instituicao: 'EE. PROFA THEODORA DE CAMARGO AYRES', logradouro: 'RUA MARTHA ZANFIROV DE CAMARGO 20', bairro: 'JARDIM SAO BARTOLOMEU', cep: '18170000', cidade: 'PIEDADE', latitude: -23.705426, longitude: -47.4257443 },
  { instituicao: 'EMEF CONEGO JOSE RODRIGUES DE OLIVEIRA', logradouro: 'R BENJAMIM CONSTANT 85', bairro: 'CENTRO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7144252, longitude: -47.4160354 },
  { instituicao: 'EMEF. NELSINA AYRES BUENO ABREU', logradouro: 'RUA LOUIS FRANCISCON S N. PAULAS E MENDES', bairro: 'CENTRO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7081303, longitude: -47.4358805 },
  { instituicao: 'EMEF. PROF. GLAUCA RAMALHO CAMARGO ARANHA', logradouro: 'RUA CAPITAO MORAES 1527', bairro: 'COTIANOS', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7279816, longitude: -47.4199572 },
  { instituicao: 'EMEF. PROF.. MARIA HELENA GUAZZELLI ROSA', logradouro: 'RUA FRANCISCO ANTONIO CORREA N 521', bairro: 'PARQUE DA TORRE', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7175098, longitude: -47.4096357 },
  { instituicao: 'EMEF. PROF.. SYLVIA DE CAMARGO BALDY', logradouro: 'RUA LAURINDO VIEIRA CARDOSO 65', bairro: 'VILA MORAES', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7655868, longitude: -47.4144153 },
  { instituicao: 'EMEIEF. MARIA JOSE MARCIANO DE ABREU', logradouro: 'RUA JOAO GONCALVES S N', bairro: 'VILA QUINTINO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7095425, longitude: -47.4060324 },

  // IBIÚNA (18150000)
  { instituicao: 'COLEGIO ANGLO IBIUNA - UNIDADE 02', logradouro: 'RODOVIA BUNJIRO NAKAO KM 72 N 1149', bairro: 'RIO DE UNA', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6640347, longitude: -47.2268212 },
  { instituicao: 'COLEGIO DOM BOSCO', logradouro: 'RUA CEL SALVADOR ROLIM DE FREITAS 290', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6575016, longitude: -47.2219634 },
  { instituicao: 'COLEGIO OBJETIVO', logradouro: 'RUA RAIMUNDO SANTIAGO 110', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6555724, longitude: -47.2193678 },
  { instituicao: 'CRECHE ESCOLA MUNICIPAL DULCE DE GOES FREITAS', logradouro: 'RUA OITO 503 RESIDENCIAL SAO LUCAS', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6785897, longitude: -47.2050278 },
  { instituicao: 'E. E. BAIRRO DA VARGEM', logradouro: 'RODOVIA JULIO DAL FABRO KM 13 5', bairro: 'VARGEM DO SALTO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.7496825, longitude: -47.2661877 },
  { instituicao: 'E.E. BAIRRO VERAVA', logradouro: 'RUA 09 S N', bairro: 'VERAVA', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.7825265, longitude: -47.0828661 },
  { instituicao: 'E.E. EUCLIDES MARIA BORBA', logradouro: 'ROD BUNJIRO NAKAO KM 59 5', bairro: 'VOTORANTIM', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.650714, longitude: -47.1279443 },
  { instituicao: 'E.M. PROF VITORIA EVANY MIGUELK CORDEIRO - CRIANCA FELIZ-', logradouro: 'RUA JOAQUIM IGNACIO RODRIGUES S N', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6584322, longitude: -47.2237079 },
  { instituicao: 'EE BAIRRO CARMO MESSIAS', logradouro: 'BAIRRO CARMO MESSIAS', bairro: 'CARMO MESSIAS', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.7503675, longitude: -47.0586828 },
  { instituicao: 'EE D OLIMPIA FALCI', logradouro: 'TRAV SERGIPE SN', bairro: 'VILA CAMARGO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6615872, longitude: -47.2265937 },
  { instituicao: 'EE FREDERICO MARCICANO', logradouro: 'AV JOAO CIPULO 51', bairro: 'RESSACA', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6729644, longitude: -47.29976 },
  { instituicao: 'EE LINO VIEIRA RUIVO', logradouro: 'RODOVIA PRESIDENTE TANCREDO ALMEIDA NEVES KM 13', bairro: 'PIAI', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6583241, longitude: -47.2113267 },
  { instituicao: 'EE MARIA ANGERAMI SCALAMANDRE', logradouro: 'R DR FRANCISCO SCALAMANDRE SOBRINHO S N', bairro: 'JARDIM NOVA IBIUNA', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6600006, longitude: -47.212751 },
  { instituicao: 'EE NAZARIA CIPRIANO DE FREITAS', logradouro: 'RODOVIA TANCREDO DE ALMEIDA NEVES KM 03', bairro: 'CAPIM AZEDO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6682799, longitude: -47.2179022 },
  { instituicao: 'EE PROF ROQUE BASTOS', logradouro: 'R GREGORIO DE ALMEIDA LIMA 246', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6528793, longitude: -47.2194179 },
  { instituicao: 'EE PROFA LAURINDA VIEIRA PINTO', logradouro: 'RUA VENEZUELA 60', bairro: 'JARDIM NOVA IBIUNA', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6595667, longitude: -47.212003 },
  { instituicao: 'EE PROFA LURDES PENNA CARMELO', logradouro: 'RODOV BUNJIRO NAKAO KM 87', bairro: 'PARURU', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.691146, longitude: -47.3402279 },
  { instituicao: 'EE PROF. MALIR TEREZINHA RAMALHO GOMES', logradouro: 'RUA SAO BENEDITO S N', bairro: 'MATADOURO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6583241, longitude: -47.2113267 },
  { instituicao: 'EMEI PEQUENO APRENDIZ', logradouro: 'R OSWALDO CRUZ S N', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6586366, longitude: -47.2231124 },
  { instituicao: 'ESCOLA COOPERATIVA DE IBIUNA', logradouro: 'AV SAO SEBASTIAO 153', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6581328, longitude: -47.2171848 },
  { instituicao: 'ESCOLA MUNICIPAL MOYSES JOSE GODINHO', logradouro: 'ESTRADA MUNICIPAL DO CAMPO VERDE S N', bairro: 'CAMPO VERDE', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6670251, longitude: -47.2547874 },
  { instituicao: 'NUCL DE ENSINO BASICO CLELIA CARMELO DA SILVA', logradouro: 'R SAO BENEDITO S N', bairro: 'MATADOURO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6569026, longitude: -47.213229 },
  { instituicao: 'NUCL INTEG DE ENSINO BASICO PROFA INES NUNES MAKIYAMA', logradouro: 'R WILSON DO CARMO FALCI S N', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6550481, longitude: -47.2230281 },

  // TAPIRAÍ (18180000)
  { instituicao: 'EE. CEL. JOAO ROSA', logradouro: 'AV. SANTA CATARINA 57', bairro: 'CENTRO', cep: '18180000', cidade: 'TAPIRAÍ', latitude: -23.9620944, longitude: -47.5049722 },
  { instituicao: 'EMEF. PROF. ENIR SILVA PILAN', logradouro: 'RUA EDUARDO COSTA MAGUETA 155', bairro: 'CENTRO', cep: '18180000', cidade: 'TAPIRAÍ', latitude: -23.961081, longitude: -47.5048763 },

  // VOTORANTIM (1811xxxx e centro)
  { instituicao: 'CMEI ROMANA FREDERICO BAUCH', logradouro: 'RUA JOSE PAZ RIBEIRO 81', bairro: 'JARDIM NOVO MUNDO', cep: '18119020', cidade: 'VOTORANTIM', latitude: -23.539563, longitude: -47.5021968 },
  { instituicao: 'CMEI ROSA PEREIRA', logradouro: 'RUA FLAVIO SAMPAIO 41', bairro: 'VILA NOVA VOTORANTIM', cep: '18113600', cidade: 'VOTORANTIM', latitude: -23.536805, longitude: -47.4101279 },
  { instituicao: 'CMEI. CARMELA DE PAULA CIPULLO', logradouro: 'RUA HORACIO VASCONCELOS LEITE 76', bairro: 'JARDIM TOLEDO', cep: '18112140', cidade: 'VOTORANTIM', latitude: -23.5282304, longitude: -47.4411756 },
  { instituicao: 'CMEI. RAPHAELA RESIO CAU', logradouro: 'RUA CARLOS CALDINI 300', bairro: 'VILA GARCIA', cep: '18112295', cidade: 'VOTORANTIM', latitude: -23.5299363, longitude: -47.4311884 },
  { instituicao: 'COLEGIO BELA ALVORADA', logradouro: 'RUA JOAO GUGONI 65', bairro: 'JARDIM ICATU', cep: '18110215', cidade: 'VOTORANTIM', latitude: -23.5430686, longitude: -47.4567774 },
  { instituicao: 'EE. COMENDADOR PEREIRA INACIO', logradouro: 'AV. SANTO ANTONIO 665', bairro: 'BARRA FUNDA', cep: '18114000', cidade: 'VOTORANTIM', latitude: -23.5474019, longitude: -47.434751 },
  { instituicao: 'EE. EVILAZIO DE GOES VIEIRA', logradouro: 'AV. CRISTIANO VIEIRA PEDRICO 568', bairro: 'JARDIM BANDEIRANTES', cep: '18115390', cidade: 'VOTORANTIM', latitude: -23.5570736, longitude: -47.4545173 },
  { instituicao: 'EE. PROF. ARMANDO RIZZO', logradouro: 'RUA RENATO ARAUJO 281', bairro: 'JARDIM ARAUJO', cep: '18114570', cidade: 'VOTORANTIM', latitude: -23.5428615, longitude: -47.427581 },
  { instituicao: 'EE. PROF. AZARIAS MENDES', logradouro: 'RUA JOSE DOLLES 53', bairro: 'JARDIM CLARICE I', cep: '18116710', cidade: 'VOTORANTIM', latitude: -23.5537089, longitude: -47.4635974 },
  { instituicao: 'EE. PROF. DANIEL VERANO', logradouro: 'RUA CARLOS LUVISON 180', bairro: 'PARQUE BELA VISTA', cep: '18110435', cidade: 'VOTORANTIM', latitude: -23.5445624, longitude: -47.4535303 },
  { instituicao: 'EE. PROF. PEDRO AUGUSTO RANGEL FILHO', logradouro: 'RUA PEDRO AUGUSTO RANGEL 1641', bairro: 'VILA NOVA VOTORANTIM', cep: '18113141', cidade: 'VOTORANTIM', latitude: -23.538023, longitude: -47.4178842 },
  { instituicao: 'EE. PROF. WILSON PRESTES MIRAMONTES', logradouro: 'RUA LEVANTE SANTUCCI S N', bairro: 'PARQUE JATAI', cep: '18115650', cidade: 'VOTORANTIM', latitude: -23.5684576, longitude: -47.454567 },
  { instituicao: 'EE. PROFA. ALICE ROLIM DE MOURA HOLTZ', logradouro: 'RUA ANALIA PEREIRA 1219', bairro: 'JARDIM SAO LUCAS', cep: '18117670', cidade: 'VOTORANTIM', latitude: -23.578518, longitude: -47.470915 },
  { instituicao: 'EE. PROFA. ANTONIETA FERRARESE', logradouro: 'RUA MATUSO MATUSHIMA 180', bairro: 'JARDIM SAO LUIS', cep: '18112680', cidade: 'VOTORANTIM', latitude: -23.5330784, longitude: -47.4352144 },
  { instituicao: 'EE. PROFA. CLOTILDE BELINE CAPITANI', logradouro: 'RUA ROQUE MARTINS DE PAULA 105', bairro: 'JARDIM ARCHILA', cep: '18112000', cidade: 'VOTORANTIM', latitude: -23.5319113, longitude: -47.4434667 },
  { instituicao: 'EE. PROFA. SELMA MARIA MARTINS CUNHA', logradouro: 'RUA ADRIANO MACIEL DE QUEIROZ 1054', bairro: 'JARDIM TATIANA', cep: '18119170', cidade: 'VOTORANTIM', latitude: -23.545563, longitude: -47.4953721 },
  { instituicao: 'EE. SENADOR JOSE ERMIRIO DE MORAES', logradouro: 'RUA ITALIA SALVESTRO MORA 381', bairro: 'VOTOCEL', cep: '18115300', cidade: 'VOTORANTIM', latitude: -23.5547982, longitude: -47.4408187 },
  { instituicao: 'EMEF MARIA DO ROSARIO ARCURI DE OLIVEIRA CAMPOS', logradouro: 'RUA PEDRO NUNES 407', bairro: 'JARDIM SERRANO II', cep: '18117121', cidade: 'VOTORANTIM', latitude: -23.5644327, longitude: -47.4572189 },
  { instituicao: 'EMEF SUELI DA SILVA PAULA', logradouro: 'RUA LAILA GALLEP SACKER N 25 - BARRA FUNDA', bairro: 'BARRA FUNDA', cep: '18114360', cidade: 'VOTORANTIM', latitude: -23.5458882, longitude: -47.4392289 },
  { instituicao: 'EMEF. IZABEL FERREIRA COELHO', logradouro: 'RUA JOSE GORI S N', bairro: 'RIO ACIMA', cep: '18113060', cidade: 'VOTORANTIM', latitude: -23.536679, longitude: -47.4353832 },
  { instituicao: 'EMEF. JOAO FERREIRA DA SILVA', logradouro: 'RUA ANGELO BRUNO 123', bairro: 'ITAPEVA', cep: '18117430', cidade: 'VOTORANTIM', latitude: -23.540286, longitude: -47.4445978 },
  { instituicao: 'EMEF. PROF. ABIMAEL CARLOS DE CAMPOS', logradouro: 'AV. LUIZ DO PATROCINO FERNANDES 641', bairro: 'RIO ACIMA', cep: '18113000', cidade: 'VOTORANTIM', latitude: -23.5406962, longitude: -47.4380803 },
  { instituicao: 'EMEF. PROF. ANTONIO VICENTE BERNARDI', logradouro: 'RUA JOSE ALARCON 50', bairro: 'JARDIM ARCHILA', cep: '18112000', cidade: 'VOTORANTIM', latitude: -23.5328966, longitude: -47.4429644 },
  { instituicao: 'EMEF. PROF. LAURO ALVES DE LIMA', logradouro: 'RUA CAETANO CORREA DA SILVA 33', bairro: 'JARDIM SERRANO', cep: '18117000', cidade: 'VOTORANTIM', latitude: -23.5623412, longitude: -47.4541142 },
  { instituicao: 'EMEF. PROF. WALTER ROCHA CAMARGO', logradouro: 'RUA ODETE GORI BICUDO 800', bairro: 'PRO-MORAR', cep: '18113400', cidade: 'VOTORANTIM', latitude: -23.5376042, longitude: -47.4112477 },
  { instituicao: 'EMEF. PROFA. DIDES CRISPIM DE ALMEIDA ANTONIO', logradouro: 'MARIO NIERI 144', bairro: 'JARDIM DANIEL ANTONIO', cep: '18112290', cidade: 'VOTORANTIM', latitude: -23.5284498, longitude: -47.4314352 },
  { instituicao: 'EMEF. PROFA. EDITH MAGANINI', logradouro: 'RUA JOAO CARLOS DE CAMPOS 359', bairro: 'VOSSOROCA', cep: '18116000', cidade: 'VOTORANTIM', latitude: -23.5496343, longitude: -47.4558006 },
  { instituicao: 'EMEF. PROFA. MERCEDES SANTUCCI', logradouro: 'RUA OZETE DOS SANTOS 203', bairro: 'JARDIM NOVO MUNDO', cep: '18119023', cidade: 'VOTORANTIM', latitude: -23.5411641, longitude: -47.5044353 },
  { instituicao: 'EMEF. PROFA. PATRICIA MARIA DOS SANTOS', logradouro: 'RUA BENEDITO GALERO 99', bairro: 'JARDIM SAO MATHEUS', cep: '18113800', cidade: 'VOTORANTIM', latitude: -23.5397596, longitude: -47.4081871 },
  { instituicao: 'EMEIEF ANTONIO MARCIANO', logradouro: 'RUA SETE DE SETEMBRO 803', bairro: 'PARQUE BELA VISTA', cep: '18110420', cidade: 'VOTORANTIM', latitude: -23.5436721, longitude: -47.458044 },
  { instituicao: 'EMEIEF GERSON SOARES DE ARRUDA', logradouro: 'RUA MAURO ALMEIDA BARROS N 57', bairro: 'PARQUE SAO JOAO', cep: '18115764', cidade: 'VOTORANTIM', latitude: -23.5701087, longitude: -47.4534781 },
  { instituicao: 'EMEIEF GILBERTO DOS SANTOS', logradouro: 'RUA LUIS FRIAS S N', bairro: 'PARQUE JATAI II', cep: '18117400', cidade: 'VOTORANTIM', latitude: -23.5713314, longitude: -47.4586027 },
  { instituicao: 'EMEIEF. BETTY DE SOUZA OLIVEIRA', logradouro: 'AVENIDA SANTOS DUMONT 1450', bairro: 'VILA DOMINGUES', cep: '18116565', cidade: 'VOTORANTIM', latitude: -23.5539887, longitude: -47.4601487 },
  { instituicao: 'EMEIEF. HELENA PEREIRA DE MORAES', logradouro: 'AV. MARGINAL VEREADOR NEWTON VIEIRA SOARES 291', bairro: 'CENTRO', cep: '18110013', cidade: 'VOTORANTIM', latitude: -23.5430433, longitude: -47.4458607 },
  { instituicao: 'EMEIEF. LUCINDA RODRIGUES PEREIRA INACIO', logradouro: 'RUA HORTENCIA MACIEL DE CAMARGO 154', bairro: 'PARQUE MORUMBI', cep: '18110630', cidade: 'VOTORANTIM', latitude: -23.5393546, longitude: -47.4615747 },
  { instituicao: 'EMEIEF. MARIA HELENA DE MORAES SCRIPILLITTI', logradouro: 'RUA EUGENIO ILDEFONSO 111', bairro: 'VOTOCEL', cep: '18115360', cidade: 'VOTORANTIM', latitude: -23.5557852, longitude: -47.4426436 },
  { instituicao: 'EMEIEF. PROF. CANDIDO DOS SANTOS', logradouro: 'RUA ANTONIO PEREIRA DE ALMEIDA 27', bairro: 'GREEN VALLEY', cep: '18119345', cidade: 'VOTORANTIM', latitude: -23.558549, longitude: -47.490696 },

  // ALUMÍNIO (18125000)
  { instituicao: 'EE HONORINA RIOS DE CARVALHO MELLO', logradouro: 'RUA FLORIANO VIEIRA 125', bairro: 'VILA PEDAGIO', cep: '18125000', cidade: 'ALUMÍNIO', latitude: -23.5177583, longitude: -47.2581715 },
  { instituicao: 'EM COMENDADOR RODOVALHO', logradouro: 'RUA ANTONIO DIAS 20', bairro: 'VILA PAULO DIAS', cep: '18125000', cidade: 'ALUMÍNIO', latitude: -23.5274667, longitude: -47.2513883 },
  { instituicao: 'EM ENG. ANTONIO DE CASTRO FIGUEIROA', logradouro: 'RUA LUIZ MARTINS 100', bairro: 'JARDIM OLIDEL', cep: '18125000', cidade: 'ALUMÍNIO', latitude: -23.5178903, longitude: -47.2496297 },
  { instituicao: 'EM PROF. ISAURA KRUGER', logradouro: 'AV. SANTIAGO 468', bairro: 'VILA INDUSTRIAL', cep: '18125000', cidade: 'ALUMÍNIO', latitude: -23.537349, longitude: -47.254331 },

  // ARAÇOIABA DA SERRA (18190000)
  { instituicao: 'CIE. PROF. OSMAR GIACOMELLI', logradouro: 'AV LUANE MILANDA DE OLIVEIRA 500', bairro: 'TOLEDOPOLIS', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.50772, longitude: -47.60127 },
  { instituicao: 'EE. PROF.. MARIA ANGELICA BAILLOT', logradouro: 'RUA MANOEL VIEIRA 587', bairro: 'CENTRO', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.508673, longitude: -47.6077509 },
  { instituicao: 'EMEF CORONEL ANTONIO RODRIGUES DE MIRANDA', logradouro: 'ESTRADA DE IPANEMA 138 A', bairro: 'ARACOIABINHA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.457127, longitude: -47.5918358 },
  { instituicao: 'EMEF. ALCEBIADES LEONEL MACHADO', logradouro: 'RUA LOURDES DIAS DE BARROS 200', bairro: 'CAMPO DO MEIO', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.5737415, longitude: -47.7012434 },
  { instituicao: 'EMEF. BAIRRO DA BARRA', logradouro: 'BAIRRO BARRA S N', bairro: 'BARRA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.639095, longitude: -47.677532 },
  { instituicao: 'EMEF. DR. CELSO CHARURI', logradouro: 'RUA ELIAS CHARURE 20', bairro: 'JUNDIAQUARA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.5706562, longitude: -47.6022916 },
  { instituicao: 'EMEF. PEDRO FERREIRA DUARTE NETO', logradouro: 'ESTRADA FAZENDA IPANEMA 138', bairro: 'ARACOIABINHA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.495311, longitude: -47.5731851 },
  { instituicao: 'EMEF. PROF.. AUREA DUARTE ROCHA', logradouro: 'RUA OSWALDO EUGENIO ANTUNES 333', bairro: 'JARDIM ERCILIA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.5080304, longitude: -47.6226463 },
  { instituicao: 'EMEF. PROF.. HELENA RODRIGUES', logradouro: 'RUA PROF. ADONIDAS TELLES MENDES MARTINS 35', bairro: 'JARDIM MARIA DA GLORIA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.5109677, longitude: -47.62091 },
  { instituicao: 'EMEF. PROF.. MARIA MIZUE NAGAISHI FLORENZANO', logradouro: 'RUA PEDRO MUNHOZ 52', bairro: 'NOVA ARACOIABA', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.5031963, longitude: -47.6134624 },
  { instituicao: 'EMEIEF. PROF.. MARIA SILVIA FLORENZANO', logradouro: 'RUA ANTONIO LOPES DOS SANTOS 30', bairro: 'BOSQUE DOS EUCALIPTOS', cep: '18190000', cidade: 'ARAÇOIABA DA SERRA', latitude: -23.5340307, longitude: -47.5683968 },

  // IPERÓ (18560000)
  { instituicao: 'EE DOUTOR GASPAR RICARDO JUNIOR', logradouro: 'RUA SANTO ANTONIO 186', bairro: 'CENTRO', cep: '18560000', cidade: 'IPERÓ', latitude: -23.3496131, longitude: -47.6889386 },
  { instituicao: 'EM DONA ELISA MOREIRA DOS SANTOS', logradouro: 'RUA FRANCISCO RIBEIRO S N', bairro: 'CENTRO', cep: '18560000', cidade: 'IPERÓ', latitude: -23.3435144, longitude: -47.6899842 },
  { instituicao: 'EM DONA ISAURA JAMAS FOGACA', logradouro: 'RUA COSTA E SILVA 440', bairro: 'CENTRO', cep: '18560000', cidade: 'IPERÓ', latitude: -23.348547, longitude: -47.694251 },
  { instituicao: 'EM FRANCISCO ADOLFO DE VARNHAGEM', logradouro: 'RUA SOARES 50', bairro: 'CAMPOS VILETA', cep: '18560000', cidade: 'IPERÓ', latitude: -23.3504027, longitude: -47.6898918 },
  { instituicao: 'EM PROFESSORA HENORY DE CAMPOS GOES', logradouro: 'RUA LUIS ROSSI 57', bairro: 'JARDIM IRENE', cep: '18560000', cidade: 'IPERÓ', latitude: -23.3485305, longitude: -47.6933835 },
  { instituicao: 'EM PROFESSORA ZILMA THIBES DE MELLO', logradouro: 'AVENIDA CECY 41', bairro: 'GEORGE OETTERER', cep: '18560000', cidade: 'IPERÓ', latitude: -23.4505744, longitude: -47.5564817 },
  { instituicao: 'EM ROQUE AYRES DE OLIVEIRA', logradouro: 'RUA ANA GUAZZELLI 200', bairro: 'BACAETAVA', cep: '18560000', cidade: 'IPERÓ', latitude: -23.3481161, longitude: -47.6909182 },

  // PILAR DO SUL (18185000)
  { instituicao: 'EE VEREADOR ODILON BATISTA JORDAO', logradouro: 'R CEL MORAES CUNHA S N', bairro: 'CENTRO', cep: '18185000', cidade: 'PILAR DO SUL', latitude: -23.813608, longitude: -47.7155799 },
  { instituicao: 'EE. PADRE ANCHIETA', logradouro: 'RUA DURVALINO COSTA E SILVA 7', bairro: 'CAMPO GRANDE', cep: '18185000', cidade: 'PILAR DO SUL', latitude: -23.8055276, longitude: -47.7259271 },
  { instituicao: 'EMEI TERESINHA MARIA PROENCA YASUDA', logradouro: 'AVENIDA PRESBITERO JOVINO GOMES 197', bairro: 'CENTRO', cep: '18185000', cidade: 'PILAR DO SUL', latitude: -23.8143773, longitude: -47.716741 },

  // SALTO DE PIRAPORA (18160000)
  { instituicao: 'EE. ANNA CUEVAS GUIMARAES', logradouro: 'RUA BRASIL 195', bairro: 'JARDIM DANIEL DAVID HADDAD', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.6618669, longitude: -47.5814274 },
  { instituicao: 'EE. BENEDICTO RODRIGUES', logradouro: 'RUA MARIA HELENA ANTUNES SIQUEIRA 150', bairro: 'RECANTO CIDADE NOVA', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.651436, longitude: -47.5696942 },
  { instituicao: 'EE. DR. AFONSO VERGUEIRO', logradouro: 'RUA ANTONIO RODRIGUES SIMOES 310', bairro: 'CENTRO', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.6475412, longitude: -47.5750847 },
  { instituicao: 'EE. JARDIM PRIMAVERA', logradouro: 'RUA OVIDIO DE BARROS LEITE 190', bairro: 'JARDIM PRIMAVERA', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.6564721, longitude: -47.577098 },
  { instituicao: 'EE. JD. DANIEL DAVID HADDAD', logradouro: 'AV PEDRO PIRES DE MELLO 850', bairro: 'CAMPO LARGO', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.662386, longitude: -47.5817764 },
  { instituicao: 'EE. PROF. BENEDICTO LEME VIEIRA NETO', logradouro: 'RUA FRANCISCO ROBERTO DANIEL 298', bairro: 'JARDIM BANDEIRAS', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.6333061, longitude: -47.5751634 },
  { instituicao: 'EMEF VEREADORA CELIA DIAS BATISTA DOS SANTOS', logradouro: 'RUA GED NICOLAU HAGE 65', bairro: 'CENTRO', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.6450612, longitude: -47.5734753 },
  { instituicao: 'EMEF. PROF.. SILVIA HADDAD', logradouro: 'RUA BELMIRO GUILHERME DA ROCHA 100', bairro: 'JARDIM AMERICA', cep: '18160000', cidade: 'SALTO DE PIRAPORA', latitude: -23.6350332, longitude: -47.5792453 },

  // CARTÓRIOS ELEITORAIS & LOCAIS ADMINISTRATIVOS DA OPERAÇÃO
  { instituicao: 'CARTORIO ELEITORAL DE VOTORANTIM', logradouro: 'RUA ALFREDO POJETTI 46', bairro: 'CENTRO', cep: '18110000', cidade: 'VOTORANTIM', latitude: -23.5411, longitude: -47.4429 },
  { instituicao: 'CARTORIO ELEITORAL DE VOTORATIM', logradouro: 'RUA ALFREDO POJETTI 46', bairro: 'CENTRO', cep: '18110000', cidade: 'VOTORANTIM', latitude: -23.5411, longitude: -47.4429 },
  { instituicao: 'CARTORIO DE IBIUNA', logradouro: 'AV SAO SEBASTIAO 349', bairro: 'CENTRO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6558, longitude: -47.2215 },
  { instituicao: 'CARTORIO DE PIEDADE', logradouro: 'RUA BENJAMIN CONSTANT 168', bairro: 'CENTRO', cep: '18170000', cidade: 'PIEDADE', latitude: -23.7125, longitude: -47.4260 },
  { instituicao: 'CMEI CARMELA GUARIGLIA RAMOS', logradouro: 'MARIO NIERI 144', bairro: 'JARDIM SERRANO II', cep: '18112290', cidade: 'VOTORANTIM', latitude: -23.5284498, longitude: -47.4314352 },
  { instituicao: 'EMEIEF EUGENIA MARIA DA SILVEIRA', logradouro: 'RUA ANISIO PEREIRA DO NASCIMENTO 109', bairro: 'JARDIM TATIANA', cep: '18119195', cidade: 'VOTORANTIM', latitude: -23.54237, longitude: -47.49166 },
  { instituicao: 'EMEIEF PROF.ª CÉLIA PIERONI', logradouro: 'RUA ANTONIO ANTUNES DE ASSIS 35', bairro: 'VILA PEDROSO', cep: '18117540', cidade: 'VOTORANTIM', latitude: -23.57601, longitude: -47.46462 },
  { instituicao: 'E M PROF. CALIL RAHAL NETO', logradouro: 'RUA PROJETA 620', bairro: 'CAPIM AZEDO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.6789693, longitude: -47.2069621 },
  { instituicao: 'CEMEI PROFA MARIA ADRIANA MARCIANO (CAMINHO DO SOL)', logradouro: 'RUA CONEGO GIORGIO MUSIZZANO 20', bairro: 'PARQUE DA TORRE', cep: '18170810', cidade: 'PIEDADE', latitude: -23.7174, longitude: -47.4102 },
  { instituicao: 'EE. PROF. WILSON PRESTES CESAR', logradouro: 'RUA LEVANTE SANTUCCI S N', bairro: 'PARQUE JATAI', cep: '18115650', cidade: 'VOTORANTIM', latitude: -23.5684576, longitude: -47.454567 },
  { instituicao: 'EE PADRE MATHEUS', logradouro: 'PRACA CORONEL MATHEUS S N', bairro: 'CENTRO', cep: '18185000', cidade: 'PILAR DO SUL', latitude: -23.8131, longitude: -47.7164 },
  { instituicao: 'EE PROFA ALZIRA VALENTE DE CASTRO', logradouro: 'RUA JOAO BRASIL S N', bairro: 'JARDIM CAMPESTRE', cep: '18185000', cidade: 'PILAR DO SUL', latitude: -23.8185, longitude: -47.7212 },
  { instituicao: 'EE PROF CORONEL GEORGE OETTERER', logradouro: 'AVENIDA CECY 41', bairro: 'GEORGE OETTERER', cep: '18560000', cidade: 'IPERÓ', latitude: -23.4505744, longitude: -47.5564817 },
  { instituicao: 'ESCOLA MUNICIPAL WALDOMIRO ANTONIO SOARES', logradouro: 'ESTRADA VICINAL VEREADOR ERNESTO PIRES DE OLIVEIRA S/N', bairro: 'VERAVA', cep: '18153634', cidade: 'IBIÚNA', latitude: -23.6920389, longitude: -47.1086176 },
  { instituicao: 'ESCOLA MUNICIPAL ZENI SOARES RAMALHO', logradouro: 'ESTRADA MUNICIPAL BAIRRO LAGEADINHO S/N', bairro: 'LAGEADINHO', cep: '18150000', cidade: 'IBIÚNA', latitude: -23.69934, longitude: -47.17378 },
  { instituicao: 'POSTO ELEITORAL - FORUM DE PILAR DO SUL', logradouro: 'PRACA PADRE LUIZ TRENTINI 330', bairro: 'CENTRO', cep: '18185000', cidade: 'PILAR DO SUL', latitude: -23.8135, longitude: -47.7162 }
];

export function normalizeSchoolForMatch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(?:EE|EM|EMEIF|EMEIEF|EMEF|CMEI|CEMEI|CIE|COLEGIO|ESCOLA|MUNICIPAL|ESTADUAL|PROFESSOR|PROFESSORA|PROF|PROFA|ENGO|ENG|ENGENHEIRO|DOUTOR|DOUTORA|DR|DRA|CORONEL|CEL|SENADOR|PADRE|DONA|VEREADOR|VEREADORA|DE|DO|DA|DOS|DAS|E)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let dynamicGeoList: SchoolGeoEntry[] = [];

/**
 * Register dynamic coordinates loaded from an external Google Spreadsheet.
 * Filters out invalid or corrupted coordinates (e.g. lat === lng).
 */
export function registerDynamicCoordinates(entries: SchoolGeoEntry[]): void {
  if (!entries || entries.length === 0) return;
  const map = new Map<string, SchoolGeoEntry>();
  // Existing dynamic entries first
  dynamicGeoList.forEach((e) => {
    if (isValidGeoEntry(e)) {
      map.set(`${e.instituicao.trim().toUpperCase()}_${e.cidade.trim().toUpperCase()}`, e);
    }
  });
  // New entries override or add if valid
  entries.forEach((e) => {
    if (isValidGeoEntry(e)) {
      map.set(`${e.instituicao.trim().toUpperCase()}_${e.cidade.trim().toUpperCase()}`, e);
    }
  });
  dynamicGeoList = Array.from(map.values());
}

function isValidGeoEntry(e: SchoolGeoEntry): boolean {
  if (typeof e.latitude !== 'number' || typeof e.longitude !== 'number') return false;
  if (isNaN(e.latitude) || isNaN(e.longitude)) return false;
  if (Math.abs(e.latitude - e.longitude) < 0.001) return false;
  // Southern & Western hemispheres (SP bounds roughly lat -20 to -26, lng -45 to -53)
  if (e.latitude > -15 || e.latitude < -35) return false;
  if (e.longitude > -40 || e.longitude < -60) return false;
  return true;
}

/**
 * Match a school name against a dynamic or custom list of SchoolGeoEntry
 */
export function matchSchoolWithGeoEntries(
  schoolName: string,
  city: string | undefined,
  entries: SchoolGeoEntry[]
): SchoolGeoEntry | null {
  if (!schoolName || !entries || entries.length === 0) return null;
  const normInput = normalizeSchoolForMatch(schoolName);
  const normCity = city
    ? city
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
    : '';

  let bestMatch: SchoolGeoEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    if (!isValidGeoEntry(entry)) continue;
    const entryNorm = normalizeSchoolForMatch(entry.instituicao);
    const entryCity = entry.cidade
      ? entry.cidade
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .trim()
      : '';

    const cityMatch = !normCity || !entryCity || entryCity.includes(normCity) || normCity.includes(entryCity);

    if (entryNorm === normInput && cityMatch) {
      return entry;
    }

    if (cityMatch) {
      const inputWords = normInput.split(' ').filter((w) => w.length > 2);
      const entryWords = entryNorm.split(' ').filter((w) => w.length > 2);
      let matches = 0;
      for (const w of inputWords) {
        if (entryWords.some((ew) => ew.includes(w) || w.includes(ew))) {
          matches++;
        }
      }
      const score = inputWords.length > 0 ? matches / inputWords.length : 0;
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestMatch = entry;
      }
    }
  }

  // Fallback ignoring city if not found in given city
  if (!bestMatch) {
    for (const entry of entries) {
      if (!isValidGeoEntry(entry)) continue;
      const entryNorm = normalizeSchoolForMatch(entry.instituicao);
      if (entryNorm === normInput) {
        return entry;
      }
      const inputWords = normInput.split(' ').filter((w) => w.length > 2);
      const entryWords = entryNorm.split(' ').filter((w) => w.length > 2);
      let matches = 0;
      for (const w of inputWords) {
        if (entryWords.some((ew) => ew.includes(w) || w.includes(ew))) {
          matches++;
        }
      }
      const score = inputWords.length > 0 ? matches / inputWords.length : 0;
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = entry;
      }
    }
  }

  return bestMatch;
}

/**
 * Return all known coordinates (dynamic + static official list)
 */
export function getAllKnownCoordinates(): SchoolGeoEntry[] {
  const map = new Map<string, SchoolGeoEntry>();
  OFFICIAL_SCHOOL_GEO_LIST.forEach((e) => {
    map.set(`${e.instituicao.trim().toUpperCase()}_${e.cidade.trim().toUpperCase()}`, e);
  });
  dynamicGeoList.forEach((e) => {
    if (isValidGeoEntry(e)) {
      map.set(`${e.instituicao.trim().toUpperCase()}_${e.cidade.trim().toUpperCase()}`, e);
    }
  });
  return Array.from(map.values());
}

/**
 * Find exact or best matching official coordinates for a given school name and optional city
 */
export function findSchoolCoordinates(
  schoolName: string,
  city?: string
): { lat: number; lng: number; address: string; logradouro?: string; bairro?: string; cep?: string; exact: boolean } | null {
  if (!schoolName) return null;

  const combinedList = [...dynamicGeoList, ...OFFICIAL_SCHOOL_GEO_LIST];
  const matched = matchSchoolWithGeoEntries(schoolName, city, combinedList);

  if (matched && isValidGeoEntry(matched)) {
    const normInput = normalizeSchoolForMatch(schoolName);
    const entryNorm = normalizeSchoolForMatch(matched.instituicao);
    const exact = normInput === entryNorm;
    return {
      lat: matched.latitude,
      lng: matched.longitude,
      address: `${matched.logradouro}, ${matched.bairro} - ${matched.cidade}`,
      logradouro: matched.logradouro,
      bairro: matched.bairro,
      cep: matched.cep,
      exact
    };
  }

  return null;
}

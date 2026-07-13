/**
 * Mint dossier entries extracted from:
 * 铸币城邑考证61.docx
 *
 * All text is quoted verbatim from the source document.
 * No descriptions have been fabricated or paraphrased beyond what is in the document.
 * Empty fields mean the information is not present in the source.
 *
 * To add or edit entries: find the mint_code below and update its fields.
 * To add images: put files under public/images/mints/ and list them in lib/mint-towns.ts.
 */

export type MintDossier = {
  mint_code: string
  /** Chinese name as it appears in document headings */
  name_zh_doc?: string
  description_zh?: string
  description_en?: string
  geolocation?: string
  coin_types?: string[]
  references?: string[]
  location_note?: string
  source_doc: string
}

export const MINT_DOSSIERS: MintDossier[] = [
  // ── BRIDGE-FOOT SPADES (桥足布) ─────────────────────────────────────────

  {
    mint_code: 'anyi',
    name_zh_doc: '安邑',
    description_zh:
      '夏县西北7.5公里，禹王村附近。城市有三重城圈，大城周长约15.5公里，中城在周长约6.5公里。小城周长约3公里。城内有丰富的战国、汉代堆积。也曾发现过铸造桥足布的陶范。《史记·魏世家》"悼公之十一年，魏绛徙治安邑。"《正义》"安邑在绛州夏县安邑故城是也。"',
    description_en:
      'Located 7.5 km northwest of Xia County, near Yuwang Village. The city consists of three enclosures, with circumferences of roughly 15.5 km, 6.5 km, and 3 km. Numerous Warring States and Han Period deposits have been found within the city (Tao and Ye 1962). Near the Miaohouzhuang village, archaeologists found the mould used to cast bridge-foot spade coins, providing direct evidence for coin production (Zhang and Huang 1983).',
    geolocation: '35.182116514281695, 111.16443424223753',
    coin_types: ['Bridge-foot spades'],
    references: ['《史记·魏世家》', '《正义》', 'Tao and Ye 1962', 'Zhang and Huang 1983'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'wei',
    name_zh_doc: '魏',
    description_zh:
      '芮城县北，中龙泉村附近。《史记·魏世家》"以魏封毕万。"《史记正义》"魏城在陕州芮城县北五里。"山西省考古研究所曾经对城址进行过调查。南城墙全长1150米，东城墙1268米，城内采集大量东周遗物。',
    description_en:
      'Located in the north of Ruicheng County, near Zhonglongquan village. Shiji recorded "In the sixteenth year of Duke Xian\'s reign, Zhao Su was the charioteer and Bi Wan was the right-hand man, leading a campaign to attack Huo, Geng, and Wei, which they destroyed. Geng was enfeoffed to Zhao Su, and Wei was enfeoffed to Bi Wan". Sun Shoujie marked the Wei city to the north 2.5 km of Ruicheng County. The Shanxi Institute of Archaeology surveyed the city. The length of the south wall is 1150 m, and the east wall is 1268 m. Numerous Eastern Zhou remains were collected from the site (Tao and Ye 1962).',
    geolocation: '34.73137309704103, 110.68667925393225',
    coin_types: ['Bridge-foot spades'],
    references: ['《史记·魏世家》', '《史记正义》', 'Tao and Ye 1962'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yinjin',
    name_zh_doc: '阴晋',
    description_zh:
      '华阴瓦渣梁。《汉书·地理志》"华阴，故阴晋，秦惠文王五年更名宁秦，高帝八年更名华阴。"80年代初陕西省考古研究所发掘瓦渣梁遗址，发现西汉京师仓，遗址南部发现带有"宁秦"戳印的残砖，并在周围发现围绕京师仓周长3330米，面积78.4万平方米的古城，城墙年代上限战国早期。',
    description_en:
      'The city of Yinjin is mentioned in both the Shiji and the Hanshu. According to the Hanshu, the county was renamed Ningqin in the fifth year of King Huiwen of Qin (333 BCE) and subsequently renamed Huayin in the eighth year of Emperor Gaozu of Han (199 BCE). In the 1980s, the Shaanxi Provincial Institute of Archaeology excavated the Wazhaliang site and uncovered the Jingshi Granary, a large storage facility dating to the Western Han period. Bricks bearing the inscription Ningqin were discovered south of the granary, indicating that the site was located within Ningqin County. Archaeological investigations also identified the remains of a walled city that can be dated to the early Warring States period. The city had a perimeter of approximately 3,330 m and enclosed an area of about 784,000 m².',
    geolocation: '34.606855497327906, 110.16925759135434',
    coin_types: ['Bridge-foot spades'],
    references: ['《汉书·地理志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'puban',
    name_zh_doc: '蒲阪',
    description_zh:
      '《括地志》"蒲阪古城在蒲州河东县南二里，即尧舜所都也。"现蒲州故城位于蒲州镇西厢村西南约1千米。根据《地图集》，当地发现唐代到明代的城址，但是没有系统工作。附近的薛家崖曾经在黄河水涨时出土大量的战国铜器，包括错金银的车具、带钩、货币等，可能与蒲阪故城有关。',
    description_en:
      'According to the Kuodizhi, Puban was located approximately 1 km south of Puzhou County. The site of Puzhou County has been identified about 1 km southwest of Xixiang Village in present-day Puzhou Town. Transmitted historical sources indicate that the location of Puban County remained unchanged until the Qing dynasty. The Atlas of Chinese Cultural Relics dates the city to the Tang–Ming periods. However, no systematic archaeological survey or excavation has yet been conducted in this area. Nevertheless, many artifacts have been discovered in nearby Xujiaya Village, including chariot fittings with gold and silver inlay, belt hooks, and coins. These finds may indicate the location of the ancient city of Puban.',
    geolocation: '34.84688258291176, 110.32932430263423',
    coin_types: ['Bridge-foot spades'],
    references: ['《括地志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'gaonu',
    name_zh_doc: '高奴',
    description_zh:
      '位于桥儿沟乡尹家沟村西200米。城址平面略呈三角形，东西约1000米，南北约900米。城墙夯筑，现存北墙及部分东、西墙，共长约2500米，残高3～6米，夯层厚9～18厘米。据《史记·项羽本纪》，项羽"立董翳为翟王，王上郡，都高奴"。张守节《正义》："《括地志》云：\'延州州城即汉高奴县\'"。',
    description_en:
      'Located on the west 200 m of the Yinjiagou Village, Qiaoergou town. The city is roughly triangular in plan, measuring about 1,000 m east–west and 900 meters north–south. The city walls were built of rammed earth. The northern wall and parts of the eastern and western walls survive today, with a total remaining length of about 2,500 m. The surviving walls are 3–6 meters high, and the rammed-earth layers are 9–18 cm thick. Zhang Shoujie quoted Kuodizhi in the Shiji Zhengyi: the Yanzhou prefectural city site is the location of Gaonu County in the Han Dynasty.',
    geolocation: '36.610145823587764, 109.51203757851496',
    coin_types: ['Bridge-foot spades'],
    references: ['《史记·项羽本纪》', '《正义》', '《括地志》', '《元和郡县志·关内道三》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yanyang',
    name_zh_doc: '言阳',
    description_zh:
      '即圁阳。戈有圁阳铭文者，根据陕北出土东汉画像石，圁阳大致分布在绥德五里店、四十里铺、中角乡一带。目前还没有报道的城址。出土画像石有出土于中角乡白家山的"西河圁阳张文卿永元十六年十月造万岁堂"、出土于四十里铺的"西河太守掾圁阳榆里田文成万岁室延平元年十月十七日塟"、出土于五里店的"圁阳西乡榆里郭稚文万岁室宅"。',
    description_en:
      'Yanyang is the Yinyang county in the Han dynasty. Based on the inscriptions on the Han pictorial stones, the location of the Yinyang county is roughly around Wulipu, Sishilipu, and Zhongjiaoxiang, but no city site has been reported. The pictorial stones discovered in Baijiashan Village, Zhongjiao town, has the inscription: "Zhang Wenqing of Yinyang, Xihe, constructed the Wansui Tomb-Chamber in the tenth month of the sixteenth year of the Yongyuan reign [104 CE]."',
    geolocation: '37.53007430074505, 110.28064749221848',
    coin_types: ['Straight-back knife', 'Bridge-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'shan',
    name_zh_doc: '陕',
    description_zh:
      '《史记·秦本纪》"十三年四月戌午，魏君为王，韩亦为王。使张仪伐取陕，出其人与魏。"陕，在今三门峡陕州区。陕县后川、三门峡刚玉砂场、大岭粮库、后川等战国秦汉墓地发现不少带有"陕亭"、"陕市"的戳印陶文。2019年以来在陕州城附近的甘棠学校发掘发现了不少东周墓葬，随葬成套青铜礼器。',
    description_en:
      'Shan was located in present-day Shanzhou District, Sanmenxia. In the 1950s, the Archaeological Team for the Yellow River Reservoir Project identified the rammed-earth city wall of Shan and excavated several cemeteries outside the city. Since then, archaeologists have found pottery inscribed with Shan ting or Shan shi—the market station or market bureau of Shan—in several cemeteries. Since 2019, the Henan Provincial Institute of Cultural Heritage and Archaeology has excavated a cemetery dating from the seventh to fifth centuries BCE, which includes several high-ranking elite tombs close to the Shan city site.',
    geolocation: '34.789193190623784, 111.17376540168375',
    coin_types: ['Bridge-foot spades'],
    references: ['《史记·秦本纪》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'shaoliang',
    name_zh_doc: '少梁',
    description_zh:
      '位于芝川镇瓦头村西、吕庄村北和嵬东乡堡安村之东。城址平面略呈长方形，东西长约1.75公里，南北宽约1.5公里。城墙夯筑，北墙无存，东、南、西墙残高0.5～2.2米，基宽6～14米，夯层厚7～9厘米。东墙辟有二门。城内北部、东北部遗存夯土建筑台基10处，残高1.7～2.4米。城内外还发现陶窑、冶铁遗址及墓葬区。1993年10月，城古村南出土一枚梁半釿布币和一块钱范。该村距离夏阳城不远，可能是铸造钱币的作坊。',
    description_en:
      'Located in the west of the Watou Village, Zhichuan Town, Hancheng. The east-west wall is 1.75 km, south-north wall is 1.5 km. The width of the city wall is 6–14 m. In the northeastern part of the site, ten rammed-earth building platforms survive, with remaining heights of 1.7–2.4 meters. Pottery kilns, iron-smelting remains, and cemetery areas have also been found both inside and outside the city. The Shiji records that in the eleventh year of the reign of King Huiwen, Shaoliang was renamed Xiayang. In October 1993, a spade coin bearing the inscription Liang banjin, together with a fragmentary coin mold, was found south of Chenggu Village, close to the city site.',
    geolocation: '35.37805481710488, 110.40007185536928',
    coin_types: ['Bridge-foot spades'],
    references: ['《史记·秦本纪》', '《正义》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'lushi',
    name_zh_doc: '卢氏',
    description_zh:
      '县城关东南隅。本春秋西虢邑，汉置卢氏县，清同治三年（1864年）更以砖石。城址平面呈长方形，城垣周长约2300米，现存夯土城垣数段，残高6米，夯层厚12—14厘米。城内外出土有东周、汉代陶鬲、鼎、罐、壶、豆残片及板瓦等建筑残构件等。',
    description_en:
      'The city site is located southeast of present-day Lushi County. The city has a perimeter of approximately 2,300 meters, and several sections of rammed-earth wall still survive today. Numerous remains dating to the Eastern Zhou and Han periods have been found at the site.',
    geolocation: '34.053308630430436, 111.0457251877067',
    coin_types: ['Bridge-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'gong',
    name_zh_doc: '共',
    description_zh:
      '辉县市区内。城址接近方形，南北1500米，东西1100米，破坏严重。城内曾发现过规模较大的铸铁遗址。史语所及中科院考古所曾先后发掘周围的琉璃阁墓地，周围还有赵固、固围村、南宿等墓地，均有出土东周青铜礼器。',
    description_en:
      'The city site is located in downtown Huixian. Its plan is roughly square, measuring approximately 1,500 meters from north to south and 1,100 meters from east to west, although it has been severely damaged by modern urbanization. A large-scale iron-production workshop has been found inside the city. Outside the city, the Institute of History and Philology, Academia Sinica, and the Institute of Archaeology, Chinese Academy of Sciences, excavated several high-ranking elite cemeteries, including Liulige, Zhaogu, and Guweicun. Gong was an important political center of the state of Wei during the Warring States period.',
    geolocation: '35.46468838986013, 113.800154242262',
    coin_types: ['Bridge-foot spades', 'Round coin'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'anyin',
    name_zh_doc: '安阴',
    description_zh:
      '地名未知。何琳仪将其左读为"阴安"，认为在河南南乐县东南。吉林省博物院藏有"七年安阴令"戈，表面存在安阴地名，未必要左读为阴安。安阴地点未知。',
    description_en:
      'The location of the site remains unknown. He Linyi read the inscription in reverse order as Yinan, identifying it with a place southeast of present-day Nanle County. However, the Jilin Provincial Museum has in its collection a ge dagger-axe bearing the inscription "Anyin county official, seventh year" (qi nian Anyin xian guan). This suggests that Anyin was already used as a county name during the Warring States period, and therefore there is no need to read the coin inscription in reverse order.',
    geolocation: 'Unknown',
    coin_types: ['Bridge-foot spades'],
    location_note: 'Location unknown',
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'xuanshi',
    name_zh_doc: '𨛶/泫氏',
    description_zh:
      '位于今天高平县治。《元和郡县图志》"高平县。本汉泫氏县，属上党郡，在泫水之上，故以为名。"谭其骧将其考订在高平县治。',
    description_en:
      'Xuanshi is located in present-day Gaoping county. Xuanshi was renamed as Gaoping in the Han dynasty, affiliated to the Shangdang prefectural. Xuanshi was named because it locates near the Xuan river. Tan Qixiang points the location to Gaoping County.',
    geolocation: '35.789246763587045, 112.92810754543565',
    coin_types: ['Bridge-foot spades', 'Square-foot spades'],
    references: ['《元和郡县图志》'],
    source_doc: '铸币城邑考证61.docx',
  },

  // ── POINTED-FOOT SPADES (尖足布) ─────────────────────────────────────────

  {
    mint_code: 'xidu',
    name_zh_doc: '西都',
    description_zh:
      '《汉书.地理志》载，西河郡有西都县。近年来，榆林市考古研究院在乔头帽古城进行调查，采集到带有"西都"字样的陶片。发现否定了以前的假设，表明乔头帽古城就是汉代的西都县。乔头帽古城附近，当地博物馆报告了公元前5世纪的青铜器发现，表明该城的历史可以追溯到战国时期。',
    description_en:
      'Xidu is affiliated with the Xihe prefecture in the Western Han Dynasty. The location of Xidu county has long been debated. Ai Chong identifies it with the Chejiaqu city site, while Ma Menglong marks it at the Haojiagatai city site. However, in recent years, the Yulin Institute of Archaeology conducted a survey in the Qiaotoumao city site, collecting pottery shards with "Xidu" inscription. The discovery disproves previous assumptions and suggests that the Qiaotoumao city site is the Xidu county in the Han Dynasty. Near the site, local museums reported findings of bronze vessels dating to the 5th century BCE.',
    geolocation: '38.472543979479624, 110.33054769804633',
    coin_types: ['Pointed-foot spades'],
    references: ['《汉书·地理志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'pingzhou',
    name_zh_doc: '平周',
    description_zh:
      '平周县战国时期最早为魏国所置。《史记·魏世家》记录，襄王"十三年张仪相魏。…秦取我曲沃、平周"。战国晚期赵国铸有"平州"字样尖足布，可能也曾短暂占据平周。吴镇烽列举1978年陕西米脂县官庄发掘的牛季平墓画像石题记，说明东汉时期平周县应在今天米脂一带。东汉末年匈奴侵占西河，平周县从河西迁到河东。平周地望以吴镇烽说法为准，地点暂定为米脂县官庄。',
    description_en:
      'Pingzhou was first set by Wei in the Warring States period. In Shiji, Qin took over Quwo and Pingzhou in the 13th year of King Xiang\'s reign. Zhao issued the pointed-foot spades with Pingzhou inscription, implying that Zhao also shortly controlled Pingzhou. Based on the transmitted texts written in the Tang Dynasty, Pingzhou was located in the west of Jiexiu County, Shanxi Province. However, in recent years, Wu Zhenfeng challenged this argument based on excavated texts. The inscriptions on the pictorial stones from the Niu Jiping tomb at Guanzhuang, Mizhi, indicate that Pingzhou is located nearby. In the Late Eastern Han Dynasty, the invasion of the Xiongnu may have caused the relocation of Pingzhou County.',
    geolocation: '37.747722222372516, 110.16228242775668',
    coin_types: ['Pointed-foot spades'],
    references: ['《史记·魏世家》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yangqu',
    name_zh_doc: '阳曲',
    description_zh:
      '阳曲城定位在晋昌镇。根据《文物地图集》，城址今日犹在，平面呈方形。现南墙、西墙、北墙部分残存，总长约1000多米，残高1~6米。墙体夯筑，夯层厚0.09~0.12米。采集有泥质灰陶盆及绳纹板瓦等残片。',
    description_en:
      'Yangqu is located in Jinchang town, Dingxiang County. According to the Atlas, the city wall is still on the ground. The plan is square, and the south, west, and north walls are still preserved. The remaining height of the city wall ranges from 1 to 6 meters. The wall was constructed with rammed earth, with rammed layers measuring 0.09–0.12 meters thick. Fragments of gray pottery shards and cord-marked tiles were collected.',
    geolocation: '38.48692489022878, 112.97113695203011',
    coin_types: ['Pointed-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'jinyang',
    name_zh_doc: '晋阳',
    description_zh:
      '晋阳城定位在太原罗城村。城址内最早发现东周时期的陶片。谢元璐与张颔最早踏查此遗址，随后不断进行发掘工作。近十年来山西省考古研究所对晋阳城进行了持续发掘。',
    description_en:
      'Jinyang is located in the Luocheng village, Taiyuan. Inside the city, archaeologists found pottery shards dated to the Eastern Zhou period. Xie Yuanlu and Zhang Han first surveyed the city. In recent years, the Shanxi Institute of Archaeology has continuously excavated the city.',
    geolocation: '37.75756222269521, 112.4779842902503',
    coin_types: ['Pointed-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yuji',
    name_zh_doc: '榆即',
    description_zh:
      '榆次城定位在榆次砖窑街一带，今晋丰一品小区。1942年日本学者对此城进行初步调查，1954年山西省文管会对这一区域继续调查并确定城址范围。2013年以来晋中市考古研究院对城址重新进行调查。城址外围有猫儿岭墓群，所出陶器有"次市"陶文，应为秦汉以来榆次县城所在。',
    description_en:
      'Yuci is located in the Zhuanwayao, Yuci County. In 1942, Japanese scholars had done a preliminary survey. In 1954, the Shanxi Institute of Archaeology continued surveying and mapping the plan of the city. Since 2013, the Jinzhong Institute of Archaeology restarted the survey. Outside of the city, near the Maoerling village, high-ranking elite tombs from the Warring States period have also been excavated. Pottery with the inscription "Ci Shi" (Market of Yuci) was found in the cemetery.',
    geolocation: '37.68881034442893, 112.75766728520112',
    coin_types: ['Pointed-foot spades', 'Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'zishi',
    name_zh_doc: '兹氏',
    description_zh:
      '《史记·秦本纪》记载，"（昭襄王）二十五年，拔赵二城。"云梦出土《编年记》也有记录，"（昭王）廿五年，攻兹氏。"秦代兹氏县属于太原郡。《读史方舆纪要》认为兹氏城在汾州府南十五里，即今天三泉镇巩村。此处有一战国城址，东西700米，南北300米，可能就是兹氏城。',
    description_en:
      'The Shiji records that in the twenty-fifth year, Qin captured two cities from Zhao. The Biannian ji (Chronicle) excavated from Shuihudi, Yunmeng, further specifies that in the twenty-fifth year of King Zhaoxiang\'s reign, Qin captured Zishi. During the Qin dynasty, Zishi County was administered under Taiyuan Commandery. The Dushi fangyujiyao states that Zishi was located fifteen li south of Fenzhou, approximately 7.5 km. The Atlas identifies the Warring States-period city at Gongcun, Sanquan Town, as the likely location of Zishi County.',
    geolocation: '37.21501666336281, 111.73989910472737',
    coin_types: ['Pointed-foot spades'],
    references: ['《史记·秦本纪》', '《编年记》', '《读史方舆纪要》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'lin',
    name_zh_doc: '蔺',
    description_zh:
      '蔺城定位在曜头乡郝塔村。根据县志记载，曜头古城遗址位于县城东北18公里，介于曜头乡郝塔村和南庄村之间。其中，内城周长2880米，东墙长170米，南墙长975米，西墙长915米，北墙长820米。外城周长4980米。城内主要有4条大自然沟。山西大学历史系曾对城址进行调查，发现一战国城址。城内采集残刀币范。结合文献记载，古城可能是战国时期的蔺。',
    description_en:
      'Lin is located in the Haota Village, Yaotou town. The Department of History, Shanxi University, had conducted a survey and found a Warring States city nearby. The inner city has a circumference of 2,880 meters, and the outer city has a circumference of 4,950 meters. Some of the high-ranking elite\'s tombs have been discovered outside of the city. Inside the city, archaeologists collected knife-coin casting molds. Fu Shumin proposed that the city is Lin County in the Warring States.',
    geolocation: '37.433038813761065, 110.89422582633883',
    coin_types: ['Pointed-foot spades', 'Square-foot spades', 'Straight-back knife', 'Round coin'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'xiangcheng',
    name_zh_doc: '襄城',
    description_zh:
      '张家坡二四七号汉墓出土的《二年律令·秩律》记录，襄城应属于上郡。马孟龙指出，战国末期秦代的上郡也有襄城，这一地点可能就是尖足布的襄城。赵国最早在陕北设置襄城县，后来被秦国所夺。颍川郡韩国的襄城在被秦国夺取以后称为"新襄城"。具体位置不详，大致在今天榆林境内。',
    description_en:
      'Xiangcheng was administered under Shang Prefecture. Ma Menglong proposes that in the late Warring States period, Xiangcheng belonged to Qin\'s Shang Prefecture and may have been captured from Zhao. The exact location of Xiangcheng County remains uncertain, but it was probably situated in present-day Yulin.',
    coin_types: ['Pointed-foot spades'],
    location_note: 'Approximate location only; exact site uncertain',
    references: ['《二年律令·秩律》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'handan',
    name_zh_doc: '甘丹',
    description_zh: '甘丹即邯郸，定位在今天邯郸赵王城。',
    description_en:
      'Gandan is Handan. The specific location is Zhaowangchang, Handan. The first systematic survey and excavation of Handan was conducted by Harada Yoshito during World War 2. After 1949, Peking University, Hebei Institute of Archaeology, and Handan Institute of Archaeology continued excavations.',
    geolocation: '36.568335217562, 114.42837633544315',
    coin_types: ['Pointed-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'dayin',
    name_zh_doc: '大阴',
    description_zh:
      '大阴即"阴"地。《左传·僖公十五年》"晋阴饴甥会秦伯，盟于王城"。杜注"阴，晋地也。"《中国历史地图集》将其标注在山西霍县东南。阴地战国时属于赵国。',
    description_en:
      'Da yin is Yin city. Zuozhuan: "In the tenth month, Yin Yi Sheng of Jin met with the Liege of Qin and swore a covenant at Wangcheng." Du Yu notes that Yin is a city of Jin. Yin is the fief of Yin Yi Sheng. The Cultural Relics Atlas of China marks Yin Dayin to the southeast of present-day Huo County. Yin belongs to Jin in the Spring and Autumn period, and then belongs to Zhao in the Warring States period. Weapon inscriptions show that Zhao was casting weapons in Da Yin.',
    geolocation: '36.57147046500399, 111.7553834556418',
    coin_types: ['Pointed-foot spades'],
    references: ['《左传·僖公十五年》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yangyi',
    name_zh_doc: '阳邑',
    description_zh:
      '梁惠成王九年，与邯郸榆次、阳邑。《水经·洞过水注》引《竹书纪年》。疑在今山西太谷县阳邑镇乡南。元和郡县志记载，阳邑故城，在县东南十五里。阳邑乡净信寺有唐开元碑刻二通，记载该地就是唐人认识的阳邑故城。',
    description_en:
      'Shuijingzhu (Commentary on the Water Classic) quotes Zhushu Jinian (Bamboo Annals): "In the ninth year of King Huicheng of Liang, (Wei/Liang) gave Yuci and Yangyi to Zhao". Yuanhejuanxiantuzhi records that the city of Yangyi is located 15 li (around 8 km) southeast of Taigu county. The Jingxin Temple in present-day Yangyi Town has two Tang-dynasty steles, and the inscriptions state that this is the site of Yangyi City.',
    geolocation: '37.43671957488965, 112.66662426377367',
    references: ['《水经·洞过水注》', '《竹书纪年》', '《元和郡县志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'lvsi',
    name_zh_doc: '虑虒',
    description_zh:
      '旧说有肤施和五台两说，现在看五台说更为合理。《汉书·地理志》记载，太原郡有虑虒县，汉代改名为五台。《文物地图集》记载，故城在五台县台城镇东北1000米，今天的古城村附近。《五台县志》记录当地出土过大量东周时期的遗存，其中包括不少布币。当地人回忆，在农业学大寨的时候发现过不少虑虒尖足布币。古城村东北3000米处的卢家坟有大量被盗的竖穴土坑积石墓，出土大量青铜器。',
    description_en:
      'Hanshu records that Lvsi County is in Taiyuan Prefecture. Lvsi was renamed to Wutai in the Han dynasty. Li Ling proposes that Lvsi is located in Wutai rather than Fushi in Northern Shaanxi. The Cultural Relics Atlas of China records an ancient city site located 1,000 m northeast of the Taicheng town, Wutai County. Wutai County Gazetteer mentions that many Eastern Zhou remains have been discovered near the city site, including many spade coins.',
    geolocation: '38.73360829009155, 113.26885192218957',
    coin_types: ['Pointed-foot spades'],
    references: ['《汉书·地理志》', '《文物地图集》', '《五台县志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'lie',
    name_zh_doc: '埒',
    description_zh:
      '《汉书·地理志》雁门郡有埒，一般认为币文之埒即是雁门郡之埒。近年来山西本地学者发现五寨县五王城遗址附近有若干次带"埒市"戳印的陶文。2017年五寨县村民锄地时捡到弩机配件"望山"，铭文证明此处为埒县所在地。根据文物地图集，城址平面呈方形，边长约500米。现存东墙残长约400米，北墙残长约300米。',
    description_en:
      'Hanshu records that Lie county is affiliated to the Yanmen prefecture. The specific location of the city of Lie is a subject of debate. Wu Liangbao proposes that Lie is located in present-day Fanshi County, while Zhu Benjun argues it is located at the junction of Ningwu County, Shenchi County, and Shuocheng District. New discoveries from Wuzhai County provide another answer: pottery shards with the inscription "Lie Shi" (the market of Lie County) were found at the Wuwangcheng city site. In 2017, a villager found a crossbow trigger bearing an inscription indicating it was made in Lie County. The Cultural Relics Atlas records that the city enclosure is square, with each side measuring around 500 m.',
    geolocation: '38.97568326329446, 111.68127421565163',
    coin_types: ['Pointed-foot spades'],
    references: ['《汉书·地理志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'zhongyang',
    name_zh_doc: '中阳',
    description_zh:
      '关于中阳的地望有三种说法：（1）柳林：《水经.河水注》约当今山西省柳林县三交镇之"吴王城"；（2）孝义：《括地志》"中阳故城在汾州隰城县南十里，汉中阳县也"；（3）神木：马孟龙根据《说文解字》判断中阳应当在秃尾河与窟野河上游，今天神木县和府谷县境内。考古调查表明此地最大汉代城址为喇嘛河古城，附近曾出土一件秦代铜戈，置用地为"中阳"。',
    description_en:
      'The location of Zhongyang County has long been a subject of debate. Based on the transmitted texts, Zhongyang is located on the east side of the Yellow River, probably in present-day Xiaoyi County or Liulin County. However, new excavated texts challenge this assumption. In the Zhangjiashan Han slips, Zhilv (Statutes on Official Ranks), Zhongyang belongs to the Shang prefecture. The Yulin Institute of Archaeology conducted a survey in the Langanbao city site and excavated a cemetery near the city site. Some pottery bears the inscription "Zhongyang," suggesting that it was produced in Zhongyang County.',
    geolocation: '38.5987186715624, 110.24145613552632',
    coin_types: ['Pointed-foot spades'],
    references: ['《水经·河水注》', '《括地志》', '《汉书·地理志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'wuan',
    name_zh_doc: '武安',
    description_zh:
      '睡虎地秦简《编年记》"八年，攻武安"，张琪《战国策释地》"故城在今彰德府武安县西南五十里。大约相当于今天的固镇村。',
    description_en:
      'Zhang Qi mentions that the city site of Wu\'an is located 50 li southeast of present-day Wu\'an County. The city site near the Guzhen village is a possible location of Wu\'an. Archaeologists found a city site near the village, measuring approximately 1,750 m from north to south and 1,500 m from east to west.',
    geolocation: '36.639937567149886, 113.97777085391965',
    coin_types: ['Pointed-foot spades', 'Square-foot spades'],
    references: ['睡虎地秦简《编年记》', '《战国策释地》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'wuping',
    name_zh_doc: '武平',
    description_zh:
      '《史记·赵世家》："赵徙漳水、武平西。""徙漳水、武平南。"武平是赵国地名，具体位置已经不可考，仅知道处于漳水流域。',
    description_en:
      'According to Shiji, Wuping is located in the Zhang River Valley. However, the specific location of this city is uncertain.',
    coin_types: ['Pointed-foot spades'],
    location_note: 'Location in Zhang River Valley only; exact site unknown',
    references: ['《史记·赵世家》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'lishi',
    name_zh_doc: '离石',
    description_zh: '故治定在今天的离石区。',
    description_en:
      'Based on the transmitted texts, Lishi is located in present-day Lishi District, Lvliang. However, no city site has been reported in this region.',
    geolocation: '37.51716800502462, 111.14669538830437',
    coin_types: ['Pointed-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'xincheng',
    name_zh_doc: '新城',
    description_zh: '《秦本纪》记录庄襄王三年"攻赵榆次、新城、狼盂，拔三十七城。"地在今山西朔县南。',
    description_en:
      'The Shiji records that in the third year of the King Zhuangxiang of Qin, Qin attacked Zhao\'s Yuci, Xincheng, and Langyu, capturing 37 cities. Wu Liangbao proposes that Xincheng is located on the south of present-day Shuo County.',
    geolocation: '39.272208931048404, 112.42566547168096',
    coin_types: ['Pointed-foot spades'],
    references: ['《秦本纪》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yu',
    name_zh_doc: '于',
    description_zh:
      '今山西阳曲县东北。《左传》昭公二十八年，"魏献子为政，分祁氏之田为七县…孟丙为盂大夫。杜预注，太原盂县。《元和郡县志》太原府：阳曲县"故盂城，汉盂县也，本春秋时晋大夫祁氏邑，在县东北八十里"。今人有定于阳曲县以北十五里大盂镇，暂从此说，存疑。',
    description_en:
      'According to the Zuozhuan, Mengbing was made high officer for Yu in the twenty-eighth year of Lord Zhao. Yu is located on the northeast of Yangqu County. Yuanhejuanxiantuzhi mentions that there is a city site located 80 li northeast of Yangqu County. Liu Weiyi marks the city site of Yu County to present-day Dayu Town.',
    geolocation: '38.202251422550184, 112.75615904005608',
    references: ['《左传》', '《元和郡县志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'huoren',
    name_zh_doc: '霍人',
    description_zh:
      '今繁峙县东。《左传》襄公十年："偪阳，妘姓也，使周内史选其族嗣，纳诸霍人，礼也。"《汉书·绛侯世家》，"击韩王信于代，降下霍人。以前至武泉。"杨伯俊认为霍人在繁峙县东郊，暂从。',
    geolocation: '39.194450454584995, 113.30895409559446',
    references: ['《左传》', '《汉书·绛侯世家》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'pingtao',
    name_zh_doc: '平陶',
    description_zh: '山西文水，地在文水县西南二十里平陶村。',
    description_en: 'Pingtao is located 10 km southeast of Wenshui County, near present-day Pingtao village.',
    geolocation: '37.343057087499524, 111.97940426286546',
    // Appears under the 尖足布 (pointed-foot spade) heading in the source document — NOT bridge-foot.
    coin_types: ['Pointed-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },

  // ── SQUARE-FOOT SPADES (方足布) ──────────────────────────────────────────

  {
    mint_code: 'nie',
    name_zh_doc: '涅',
    description_zh:
      '《水经·浊漳水注》引《竹书纪年》，"梁惠成王十二年，郑取屯留、尚子、涅。"《汉书·地理志》属上党郡，在武乡县西北。可能是今武乡故城。《地图集》记录，城址平面形状不详。地表残存城墙2段，其中一段残长约10米，基宽约7米，残高3~4米。墙体夯筑，夯层厚约0.15米。城址内采集有泥质灰陶盆、豆、甑及绳纹板瓦、筒瓦等残片。',
    description_en:
      'In Shuijingzhu, in the 11th year of the reign of King Huicheng, Zheng captured Tunliu, Shangzi, and Nie. Nie is in Shangdang prefecture in Hanshu, located on the northwest of Wuxiang County. The atlas proposes that it is located in present-day Gucheng village. Two sections of the city wall remain visible on the surface, with a basal width of about 7 meters and a remaining height of 3–4 meters. Fragments of fine gray pottery and cord-marked tiles were collected within the city site.',
    geolocation: '36.94646113228423, 112.66485453135783',
    coin_types: ['Square-foot spades'],
    references: ['《水经·浊漳水注》', '《竹书纪年》', '《汉书·地理志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'changzi',
    name_zh_doc: '长子',
    description_zh:
      '位于今天长子县城西3公里孟家庄村北。北有雍河，南有浊漳河南源。城址东西3公里，南北0.5公里，占地面积1.5平方公里整体呈长方形，城基8-10米，夯层8-10厘米。城角残存大量东周时期的瓦片。孟家庄附近有发现大量战国墓葬，其中不少有随葬青铜礼器。1972、1973、1979年，羊圈沟和牛家坡发掘大量墓葬，其中7号墓规模最大，包括鼎、壶等礼器。1989年又在孟家庄村北清理18座战国墓。',
    geolocation: '36.11119210230051, 112.84762262132867',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'xiangyuan',
    name_zh_doc: '襄垣',
    description_zh: '《汉书·地理志》隶属上党郡，在今天襄垣县北。',
    geolocation: '36.52448597592109, 113.03643567917791',
    coin_types: ['Square-foot spades'],
    references: ['《汉书·地理志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'lu',
    name_zh_doc: '潞',
    description_zh:
      '位于潞城区东北25公里西流乡与古城村一带。东西2公里，南北1.5公里，占地3平方公里。1983年陕西省考古研究所和晋东南地区文化局联合，进行了调查钻探和发掘。故城现存西城墙和北城墙一部分，西城墙长358米，北城墙长210米，城内方才及大量东周陶器。70年代当地农民取土发现西周晚期的"虞侯政"壶，82年发现战国早期7号墓，总共13鼎，7+5组合。',
    geolocation: '36.426815566492564, 113.37008926984404',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'zhongdu',
    name_zh_doc: '中都',
    description_zh:
      '《史记·秦本纪》，"秦伐取赵中都、西阳"。《水经注·汾水》记载，"侯甲水又西北迳中都县故城南，城临际水湄。"《括地志》云"中都故县在汾州平遥县西十二里。"这一位置在今天中都乡以南，此处有中都桥遗址，在县城以西5公里桥头村一带。中都桥附近有双林寺，原名中都寺，北齐武平二年重修。',
    geolocation: '37.209684345566274, 112.13474332506024',
    coin_types: ['Square-foot spades'],
    references: ['《史记·秦本纪》', '《水经注·汾水》', '《括地志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'pingyang',
    name_zh_doc: '平阳',
    description_zh:
      '《史记·韩世家》晋定公十五年"（韩）贞子徙居平阳"，韩哀侯二年"灭郑，因徙都新郑"。近年来在襄汾古城庄村附近发现不少带有"平市"戳印的陶器，战国时代的平阳应当就在此地。',
    geolocation: '35.938207372097175, 111.47310255622602',
    coin_types: ['Square-foot spades'],
    references: ['《史记·韩世家》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'anyang',
    name_zh_doc: '安阳',
    description_zh:
      '安阳位置有多种说法，均有可能。',
    geolocation: '40.535810176428086, 109.84095513177722',
    coin_types: ['Square-foot spades'],
    location_note: 'Multiple candidate locations; geolocation is provisional',
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'dai',
    name_zh_doc: '𮟪/代',
    description_zh:
      '李家浩改释为"代"。根据文献和考古发现的城址比对，代城位于今天河北蔚县的代王城，城址呈椭圆形，东西3400米，南北2200米，周长9266米。代王城附近有很丰富的东周遗存，近年来对大德庄等代王城附近的墓地发掘中发现了高等级贵族的墓葬。代在战国文献所见颇多。赵襄子又杀代王，兼并代国。',
    geolocation: '39.895801374312484, 114.67770764303596',
    coin_types: ['Square-foot spades'],
    references: ['《水经注·㶟水》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'tujun',
    name_zh_doc: '土军',
    description_zh:
      '《水经注·河水》吐京郡治。《元和郡县图志》"石楼县，本汉土军县也，属西河郡。晋省。后魏孝文帝于此城置吐京郡，即汉土军县。盖胡俗音讹，以军为京也。"一般认为土军县治就在今天的石楼县治灵泉镇。',
    geolocation: '36.99908974837604, 110.84772125952064',
    references: ['《水经注·河水》', '《元和郡县图志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'pingyin',
    name_zh_doc: '平阴',
    description_zh:
      '《史记·赵世家》"（幽缪王）五年，代地大动，自乐徐以西，北至平阴，台屋墙垣太半坏，地坼东西百三十步。"《中国历史地图集》将平阴标在阳高县以南。朱本军认为《地图集》记录的阳高县古城遗址就是平阴县。古城遗址位于山前台地上，面积约42万平方米，文化层厚0.5~0.8米。',
    geolocation: '40.138879908242465, 113.9629210837557',
    coin_types: ['Square-foot spades'],
    references: ['《史记·赵世家》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'pingshu',
    name_zh_doc: '平舒',
    description_zh:
      '黄锡全将原来释作"平于"的方足布改释为"平舒"，认为是位于广灵县的汉代平舒县。《地图集》将平舒故城标注在今作曈乡百疃南堡村西南。平面呈长方形，南北长约300米，东西宽约200米。现存西南和西北墙角残段，残长约90米，残高3~5米。墙体夯筑，夯层厚0.6~0.12米。',
    geolocation: '39.910108935314014, 114.30895757971702',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'wuxian',
    name_zh_doc: '邬',
    description_zh:
      '《左传·昭公二十八年》："司马弥牟为邬大夫"。《水经·汾水注》"侯甲水又西，合于婴侯之水，迳邬县故城南，晋大夫司马弥牟之邑也。"吴良宝认为位于介休县东北。李晓杰根据成化《山西通志》及《大清一统志》将邬县故城标注在连福镇邬城店村。',
    geolocation: '37.10724214015365, 112.03819093780749',
    coin_types: ['Square-foot spades'],
    references: ['《左传·昭公二十八年》', '《水经·汾水注》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'beiqu',
    name_zh_doc: '北屈',
    description_zh:
      '《左传·庄公二十八年》"公使夷吾居屈"。《水经注·河水》"河水南迳北屈县故城西。"杨伯峻《春秋左传注》"北屈在今吉县东北"。李晓杰将北屈定位在吉县车城乡麦城村。《地图集》描述"平面呈长方形，南北长约2000米，东西宽约1500米。现存城墙残段。城墙最长一段约80米，基宽5～7米，残高5～6.5米。墙体夯筑，夯层厚0.1～0.15米。"',
    geolocation: '36.191688069924666, 110.69586589724332',
    coin_types: ['Square-foot spades'],
    references: ['《左传·庄公二十八年》', '《水经注·河水》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yiyang',
    name_zh_doc: '宜阳',
    description_zh:
      '位于宜阳县韩城镇。韩武子迁都宜阳，韩景侯迁都阳翟。战国晚期秦与韩曾围绕宜阳展开激烈的争夺战，最终归秦。1989年洛阳市第二文物工作队曾经对宜阳故城进行勘探，1991年进行试掘。',
    geolocation: '34.49161450186632, 111.92877925174814',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'xicheng',
    name_zh_doc: '隰城',
    description_zh:
      '根据《地图集》，隰城位于穆村镇杨家坪村东北约2.5千米。平面呈长方形，东西长约150米，南北宽约100米。现存东墙残段，残长约20米，基宽3~4米，顶宽0.8~1.4米，残高1~5米。墙体夯筑，夯层厚0.08~0.10米。杨家坪还曾发掘过东周铜器墓葬，铜礼器年代战国中期。清光绪《永宁州志》载，该城为汉代隰城县治所。',
    geolocation: '37.41759114185272, 110.86100426359009',
    coin_types: ['Square-foot spades'],
    references: ['《文物地图集》', '《永宁州志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'zhaiyang',
    name_zh_doc: '宅阳',
    description_zh:
      '括地志云宅阳故城名北宅在郑州荥阳县东南十七里也。根据唐代荥阳县城的位置，将宅阳定在今天高新区万达广场附近。东赵战国城址在荥阳故城南大约8公里处，城址面积接近60万平方米。可能就是所谓的宅阳。',
    geolocation: '34.82361196588034, 113.57381232759029',
    coin_types: ['Square-foot spades'],
    references: ['《括地志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'tunliu',
    name_zh_doc: '屯留',
    description_zh:
      '定位在今天屯留县古城。屯留附近的西李高、东李高、鲍店一带有大量的战国墓葬群，其中鲍店还发现了战国早期的高等级贵族墓，可能是晋国公室的墓葬。',
    geolocation: '36.25943192883583, 112.90412096137788',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'tongshi',
    name_zh_doc: '同是',
    description_zh:
      '《左传·成公九年》"晋人执诸铜鞮"。《括地志》云，铜鞮故城在潞州铜县东十五里，州西六十五里。在今山西沁县南。王俊调查认为铜鞮当在古铜鞮水附近，具体位置在南池乡古城村南约200米与下尧村相接的古城坪上，此处有大片东周遗址，还发现有夯土。',
    geolocation: '36.42614657863702, 113.37040336549124',
    coin_types: ['Square-foot spades'],
    references: ['《左传·成公九年》', '《括地志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'pishi',
    name_zh_doc: '皮氏',
    description_zh:
      '《水经·汾水注》"魏襄王十二年，秦公孙爰率师伐我，围皮氏"，在今山西河津县。河津县志称，皮氏县城位于县西二里阳村。《括地志》皮氏故城在绛州龙门县西一百八十步。',
    geolocation: '35.58225668103926, 110.67360747350013',
    coin_types: ['Square-foot spades'],
    references: ['《水经·汾水注》', '《括地志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'suanzao',
    name_zh_doc: '酉枣',
    description_zh:
      '即酸枣。《史记·秦始皇本纪》"五年，将军骜攻魏，定酸枣、燕、虚、长平、雍丘、山阳城，皆拔之，取二十城"。《括地志》"酸枣故城在滑州酸枣县北十五里古酸枣县南"。在今河南延津县南。',
    geolocation: '35.14136577834776, 114.20452041348454',
    coin_types: ['Square-foot spades'],
    references: ['《史记·秦始皇本纪》', '《括地志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'qishi',
    name_zh_doc: '奇氏',
    description_zh:
      '即猗氏。猗氏故城在今临猗县猗氏镇铁匠营村东。此处有一东周至汉代城址。《寰宇记》"地理志猗氏属河东郡，在今县二十里猗氏故城是也。"北宋猗氏县治今临猗县城区，铁匠营城址正在其南二十里处。',
    geolocation: '35.061994165124325, 110.77943127286957',
    coin_types: ['Square-foot spades'],
    references: ['《寰宇记》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'puzi',
    name_zh_doc: '蒲子',
    description_zh:
      '《左传·庄公二十八年》，"夏，（献公）使大子申生居曲沃，重耳居蒲城，夷吾居屈。"杜预注："蒲，今平阳蒲子县，二屈居今平阳北屈县。"以往曾在古城村发现过带有"蒲"铭文的陶器和刻有"蒲关"二字的筒瓦。可能是战国时期的蒲子县。',
    geolocation: '36.700343533791106, 110.94277733068412',
    coin_types: ['Square-foot spades'],
    references: ['《左传·庄公二十八年》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'daliang',
    name_zh_doc: '大梁',
    description_zh:
      '以往认为梁即是大梁。李家浩辨别战国时期的梁、大梁、少梁。大梁则是指魏国的都城，位于今天的开封。',
    geolocation: '34.80557669420362, 114.30102339441821',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'gaodu',
    name_zh_doc: '高都',
    description_zh:
      '战国为魏国高都，汉代为高都县，因袭至隋代，改为泽州。高都位置在今泽州县高都镇附近。根据文物地图集、今天高都镇和附近的北义城镇附近有大量从新石器至汉代遗址，其中大南社遗址面积达24万平方米，包含西周、东周遗存，可能即是高都故城所在。',
    geolocation: '35.59137713121943, 112.96456828906605',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'yuyang',
    name_zh_doc: '𫊣阳',
    description_zh:
      '吴荣增认为应当是"虞阳"，即虞城，位于山西平陆。《地图集》指出，虞城位于张店镇古城村。城址平面呈长方形，南北长2500米，东西宽2000米。南、北城墙保存较好，其中南墙残长约300米，基宽15~20米。墙体夯筑，夯层厚0.06~0.08米。城中部有东西向的隔城墙。据清乾隆《平陆县志》记载，城为春秋时晋献公所灭的古虞国都城。',
    geolocation: '34.97509628309281, 111.21365534720621',
    coin_types: ['Square-foot spades'],
    references: ['《文物地图集》', '《平陆县志》'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'dongzhou',
    name_zh_doc: '东周',
    description_en:
      'King K\'an enfeoffed his brother with Henan thereby to prolong the position of the Duke of Zhou. "He (Duke Wei) then enfeoffed his youngest son with Gong, thereby to serve the king, and called him Duke Hui of East Zhou." The city located in present-day Kangdian Village, Kangdian Town, Gongyi City. The eastern wall of the city has been destroyed by the Luo River. Part of the northern section of the western wall and the north western corner of the city wall are still preserved. Numerous remains of Warring States and Han-period pottery shards has been collected within the city.',
    geolocation: '34.75576167552476, 112.9506069499937',
    coin_types: ['Square-foot spades'],
    references: ['Sima 1994, 79', 'Guojia wenwuju 1991, 35'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'guanyang',
    name_zh_doc: '冠阳',
    description_en:
      'Huang Xiquan transcribed it into clerical script as Guanyang. Guanyang is pronounced "yuanyang" and is located southeast of present-day Hohhot. Li Yiyou proposed that Yuanyang is located in Jinhe Town, Babai Village. Archaeologists found the city and numerous remains from the Warring States to the Western Han periods.',
    geolocation: '40.74969586609028, 111.8028486914162',
    coin_types: ['Square-foot spades'],
    references: ['Li 1992, 70'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'beixun',
    name_zh_doc: '北尋',
    description_zh:
      '今巩洛渡北，有鄩谷水东入洛，谓之下鄩。故有上鄩、下鄩之名，亦谓之北鄩，于是有南鄩、北鄩之称矣。又有鄩城，盖周大夫鄩肸之旧邑。',
    description_en:
      'He Linyi transcribed it into Beixun, proposing that the inscription indicates the Xun city in the Shuijingzhu. Li Xiaojie used Kuodizhi and Henan Fuzhi to mark the location of Xun at present-day Huiguo town, Beiluo village. However, there is no direct evidence to prove this assumption. Today, to the north of Gongluo Du, there is a stream from Xun Gu flowing east into the Luo Shui; it is called Xiaxun.',
    geolocation: '34.68083604775812, 112.87079038915016',
    coin_types: ['Square-foot spades'],
    references: ['《水经注》'],
    source_doc: '铸币城邑考证61.docx',
  },

  // ── continuation of SQUARE-FOOT SPADES (方足布) — Yan-state mints ──────────
  // No new section heading appears before these entries in the source document;
  // they immediately follow 北尋 under 方足布, and their inscriptions (襄平, 广昌,
  // 重平, 韩皋) are square-foot spade mint names, not knife coins.

  {
    mint_code: 'yanduxia',
    name_zh_doc: '燕下都',
    geolocation: '39.30671189251951, 115.5314403699175',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'hangao',
    name_zh_doc: '韩皋',
    geolocation: '39.395260021837665, 116.32021387926758',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'xiangping',
    name_zh_doc: '襄平',
    geolocation: '41.27181863496425, 123.18660660408902',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'guangchang',
    name_zh_doc: '广昌',
    geolocation: '39.35522181162929, 114.70505445191453',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
  {
    mint_code: 'chongping',
    name_zh_doc: '重平',
    geolocation: '37.6275454947458, 116.43011697105231',
    coin_types: ['Square-foot spades'],
    source_doc: '铸币城邑考证61.docx',
  },
]

export function getMintDossierByCode(mintCode: string): MintDossier | undefined {
  return MINT_DOSSIERS.find((d) => d.mint_code === mintCode)
}

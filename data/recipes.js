// data/recipes.js — 内置 30 款经典鸡尾酒配方库

const RECIPES = [
  // ── 金酒 ──
  // {
  //   id: 1, emoji:'🍸', name:'马天尼', base:'金酒', style:'经典', abv:28, difficulty:2,
  //   desc:'鸡尾酒之王，简洁而优雅，喜好可调整苦艾酒比例。',
  //   ingredients:[
  //     { name:'金酒', amount:'60ml' }, { name:'苦艾酒（干）', amount:'10ml' },
  //     { name:'橄榄', amount:'1颗' },
  //   ],
  //   steps:['冰镇马天尼杯','将金酒与苦艾酒加冰搅拌30次','滤入杯中','橄榄点缀'],
  //   notes:'搅拌而非摇晃，保留清澈度。'
  // },
  // {
  //   id: 2, emoji:'🍋', name:'金汤力', base:'金酒', style:'清爽', abv:10, difficulty:1,
  //   desc:'最简单的金酒喝法，气泡与柑橘香完美结合。',
  //   ingredients:[
  //     { name:'金酒', amount:'45ml' }, { name:'汤力水', amount:'120ml' },
  //     { name:'青柠', amount:'1片' },
  //   ],
  //   steps:['杯中加满冰块','倒入金酒','缓慢注入汤力水','青柠挤汁后放入'],
  //   notes:'汤力水冰镇后使用，碳酸更丰富。'
  // },
  // {
  //   id: 3, emoji:'🌿', name:'内格罗尼', base:'金酒', style:'经典', abv:24, difficulty:2,
  //   desc:'苦甜平衡的完美典范，意大利经典。',
  //   ingredients:[
  //     { name:'金酒', amount:'30ml' }, { name:'金巴利', amount:'30ml' },
  //     { name:'甜苦艾酒', amount:'30ml' }, { name:'橙皮', amount:'1条' },
  //   ],
  //   steps:['加冰搅拌30秒','滤入老式杯大冰块上','橙皮扭转挤油','放入杯中'],
  //   notes:'等比例三种原料，初学者也容易掌握。'
  // },
  // {
  //   id: 4, emoji:'🐝', name:'蜂之膝', base:'金酒', style:'经典', abv:20, difficulty:2,
  //   desc:'禁酒令时代的遗产，蜂蜜柠檬的清新组合。',
  //   ingredients:[
  //     { name:'金酒', amount:'60ml' }, { name:'柠檬汁', amount:'22ml' },
  //     { name:'蜂蜜糖浆', amount:'22ml' },
  //   ],
  //   steps:['摇酒壶加冰','加入所有原料','用力摇15秒','双重过滤倒入冰镇碟形杯'],
  //   notes:'蜂蜜糖浆可用等量蜂蜜+水制作。'
  // },
  // // ── 伏特加 ──
  // {
  //   id: 5, emoji:'🍑', name:'莫斯科骡子', base:'伏特加', style:'清爽', abv:10, difficulty:1,
  //   desc:'姜啤与伏特加的经典组合，传统用铜杯盛放。',
  //   ingredients:[
  //     { name:'伏特加', amount:'45ml' }, { name:'青柠汁', amount:'15ml' },
  //     { name:'姜啤', amount:'120ml' }, { name:'青柠片', amount:'1片' },
  //   ],
  //   steps:['铜杯或高球杯加满冰','倒入伏特加和青柠汁','注入姜啤','轻搅后青柠装饰'],
  //   notes:'姜啤不要过度搅拌，保留气泡。'
  // },
  // {
  //   id: 6, emoji:'🍊', name:'螺丝刀', base:'伏特加', style:'果味', abv:12, difficulty:1,
  //   desc:'最简单易饮的伏特加鸡尾酒，果汁比例可随意调整。',
  //   ingredients:[
  //     { name:'伏特加', amount:'45ml' }, { name:'橙汁', amount:'100ml' },
  //     { name:'橙片', amount:'1片' },
  //   ],
  //   steps:['高球杯加冰','倒入伏特加','加满新鲜橙汁','轻搅后橙片装饰'],
  //   notes:'使用现榨橙汁风味更佳。'
  // },
  // {
  //   id: 7, emoji:'🍈', name:'柯斯摩', base:'伏特加', style:'果味', abv:22, difficulty:2,
  //   desc:'粉色鸡尾酒的代表，酸甜平衡、视觉迷人。',
  //   ingredients:[
  //     { name:'柠檬伏特加', amount:'45ml' }, { name:'君度橙酒', amount:'15ml' },
  //     { name:'蔓越莓汁', amount:'30ml' }, { name:'青柠汁', amount:'10ml' },
  //   ],
  //   steps:['摇酒壶加冰','加入所有原料','用力摇12秒','过滤倒入冰镇马天尼杯','橙皮装饰'],
  //   notes:'蔓越莓汁用量决定粉色深浅。'
  // },
  // {
  //   id: 8, emoji:'🥒', name:'血腥玛丽', base:'伏特加', style:'咸鲜', abv:12, difficulty:3,
  //   desc:'最著名的早午餐鸡尾酒，配料可自由发挥。',
  //   ingredients:[
  //     { name:'伏特加', amount:'45ml' }, { name:'番茄汁', amount:'90ml' },
  //     { name:'柠檬汁', amount:'15ml' }, { name:'辣椒酱', amount:'2滴' },
  //     { name:'伍斯特酱', amount:'2滴' }, { name:'盐胡椒', amount:'适量' },
  //   ],
  //   steps:['高球杯加冰','加入除装饰外所有原料','轻柔搅拌','芹菜棒和柠檬装饰'],
  //   notes:'辣度可根据客人喜好调整。'
  // },
  // // ── 朗姆酒 ──
  // {
  //   id: 9, emoji:'🌿', name:'莫吉托', base:'朗姆酒', style:'清爽', abv:12, difficulty:2,
  //   desc:'古巴国民鸡尾酒，薄荷清香令人愉悦。',
  //   ingredients:[
  //     { name:'白朗姆酒', amount:'45ml' }, { name:'青柠汁', amount:'20ml' },
  //     { name:'简单糖浆', amount:'15ml' }, { name:'薄荷叶', amount:'8片' },
  //     { name:'苏打水', amount:'60ml' },
  //   ],
  //   steps:['薄荷叶与糖浆青柠汁轻轻捣压','填满碎冰','倒入朗姆酒','苏打水补满','薄荷枝装饰'],
  //   notes:'捣压薄荷时力道轻柔，避免苦味。'
  // },
  // {
  //   id: 10, emoji:'🍍', name:'椰林飘香', base:'朗姆酒', style:'果味', abv:13, difficulty:1,
  //   desc:'海滩度假的味道，甜美热带风情。',
  //   ingredients:[
  //     { name:'白朗姆酒', amount:'45ml' }, { name:'菠萝汁', amount:'90ml' },
  //     { name:'椰奶', amount:'30ml' },
  //   ],
  //   steps:['将所有原料与冰块放入搅拌机','搅拌至顺滑','倒入飓风杯','菠萝片装饰'],
  //   notes:'可不用搅拌机，直接摇匀后过滤。'
  // },
  // {
  //   id: 11, emoji:'🌊', name:'戴克利', base:'朗姆酒', style:'经典', abv:20, difficulty:2,
  //   desc:'古典朗姆鸡尾酒三元素的完美平衡。',
  //   ingredients:[
  //     { name:'白朗姆酒', amount:'60ml' }, { name:'青柠汁', amount:'25ml' },
  //     { name:'简单糖浆', amount:'15ml' },
  //   ],
  //   steps:['摇酒壶加冰','加入所有原料','用力摇15秒','双重过滤倒入冰镇碟形杯'],
  //   notes:'糖浆用量可微调，平衡个人口味。'
  // },
  // {
  //   id: 12, emoji:'🍫', name:'迈泰', base:'朗姆酒', style:'果味', abv:18, difficulty:3,
  //   desc:'Tiki 文化的标志，多层次热带风味。',
  //   ingredients:[
  //     { name:'深色朗姆酒', amount:'30ml' }, { name:'白朗姆酒', amount:'30ml' },
  //     { name:'橙皮利口酒', amount:'15ml' }, { name:'青柠汁', amount:'30ml' },
  //     { name:'杏仁糖浆', amount:'15ml' },
  //   ],
  //   steps:['摇酒壶加冰','加入所有原料','摇匀后倒入碎冰杯','深色朗姆漂浮在顶部','薄荷和青柠装饰'],
  //   notes:'深色朗姆最后沿杯壁轻倒，形成漂浮层。'
  // },
  // // ── 龙舌兰 ──
  // {
  //   id: 13, emoji:'🍋', name:'玛格丽特', base:'龙舌兰', style:'经典', abv:22, difficulty:2,
  //   desc:'最受欢迎的龙舌兰鸡尾酒，盐边是其标志。',
  //   ingredients:[
  //     { name:'银龙舌兰', amount:'50ml' }, { name:'君度橙酒', amount:'20ml' },
  //     { name:'青柠汁', amount:'20ml' }, { name:'盐边', amount:'适量' },
  //   ],
  //   steps:['杯口用青柠汁润湿蘸盐','摇酒壶加冰','加入所有原料','摇匀后滤入杯中或倒在冰块上'],
  //   notes:'鲜榨青柠汁是关键，避免使用瓶装。'
  // },
  // {
  //   id: 14, emoji:'🍑', name:'百香果玛格丽特', base:'龙舌兰', style:'果味', abv:18, difficulty:2,
  //   desc:'经典玛格丽特的热带升级版，毛利率极佳。',
  //   ingredients:[
  //     { name:'银龙舌兰', amount:'45ml' }, { name:'百香果利口酒', amount:'20ml' },
  //     { name:'君度橙酒', amount:'15ml' }, { name:'青柠汁', amount:'25ml' },
  //     { name:'简单糖浆', amount:'10ml' },
  //   ],
  //   steps:['摇酒壶加冰','加入所有原料','用力摇12秒','双重过滤倒入冰镇马天尼杯','百香果片装饰'],
  //   notes:'青柠汁和百香果形成完美酸度层次。'
  // },
  // {
  //   id: 15, emoji:'🌅', name:'龙舌兰日出', base:'龙舌兰', style:'果味', abv:13, difficulty:1,
  //   desc:'渐变色彩如日出，视觉效果极佳。',
  //   ingredients:[
  //     { name:'银龙舌兰', amount:'45ml' }, { name:'橙汁', amount:'90ml' },
  //     { name:'石榴糖浆', amount:'15ml' },
  //   ],
  //   steps:['高球杯加冰','倒入龙舌兰和橙汁','搅拌均匀','沿杯壁缓慢注入石榴糖浆（不搅拌）','橙片装饰'],
  //   notes:'石榴糖浆沉底后自然渐变，不要搅拌。'
  // },
  // // ── 威士忌 ──
  // {
  //   id: 16, emoji:'🥃', name:'老式鸡尾酒', base:'威士忌', style:'经典', abv:30, difficulty:2,
  //   desc:'威士忌鸡尾酒的祖先，简单却需要精准。',
  //   ingredients:[
  //     { name:'波本威士忌', amount:'60ml' }, { name:'简单糖浆', amount:'10ml' },
  //     { name:'安格仕苦精', amount:'2dash' }, { name:'橙皮', amount:'1条' },
  //   ],
  //   steps:['将糖浆和苦精放入威士忌杯','加入大冰块','倒入波本威士忌','轻搅20次','橙皮扭转装饰'],
  //   notes:'搅拌而非摇晃，保留威士忌本味。'
  // },
  // {
  //   id: 17, emoji:'🍒', name:'曼哈顿', base:'威士忌', style:'经典', abv:28, difficulty:2,
  //   desc:'纽约的象征，黑樱桃是其标志。',
  //   ingredients:[
  //     { name:'黑麦威士忌', amount:'60ml' }, { name:'甜苦艾酒', amount:'30ml' },
  //     { name:'安格仕苦精', amount:'2dash' }, { name:'酒浸樱桃', amount:'1颗' },
  //   ],
  //   steps:['搅拌杯加冰','加入威士忌、苦艾酒和苦精','搅拌30次','滤入冰镇马天尼杯','樱桃装饰'],
  //   notes:'可用安格仕橙味苦精代替原版苦精。'
  // },
  // {
  //   id: 18, emoji:'🌫️', name:'威士忌酸', base:'威士忌', style:'经典', abv:20, difficulty:2,
  //   desc:'酸类鸡尾酒代表作，蛋清带来丝绸般泡沫。',
  //   ingredients:[
  //     { name:'波本威士忌', amount:'50ml' }, { name:'柠檬汁', amount:'25ml' },
  //     { name:'简单糖浆', amount:'20ml' }, { name:'蛋清', amount:'1个' },
  //   ],
  //   steps:['不加冰干摇15秒（乳化蛋清）','加冰再摇15秒','双重过滤倒入岩石杯','安格仕苦精点缀泡沫'],
  //   notes:'干摇是关键步骤，使蛋清充分乳化。'
  // },
  // // ── 起泡酒 / 利口酒 ──
  // {
  //   id: 19, emoji:'🥂', name:'贝里尼', base:'桃子泥', style:'清爽', abv:6, difficulty:1,
  //   desc:'威尼斯的早午餐饮品，轻盈甜美。',
  //   ingredients:[
  //     { name:'桃子泥', amount:'50ml' }, { name:'普罗塞克', amount:'100ml' },
  //   ],
  //   steps:['冷藏香槟杯','倒入桃子泥','缓缓注入起泡酒','轻轻搅拌一下'],
  //   notes:'桃子泥新鲜制作风味最佳。'
  // },
  // {
  //   id: 20, emoji:'🌹', name:'法国75', base:'金酒', style:'经典', abv:16, difficulty:2,
  //   desc:'一战时代的经典，金酒与香槟的高贵结合。',
  //   ingredients:[
  //     { name:'金酒', amount:'30ml' }, { name:'柠檬汁', amount:'15ml' },
  //     { name:'简单糖浆', amount:'10ml' }, { name:'香槟', amount:'60ml' },
  //   ],
  //   steps:['摇酒壶加冰','金酒柠檬汁糖浆摇匀','滤入香槟杯','顶上香槟','柠檬皮装饰'],
  //   notes:'起泡酒最后加入，保留气泡。'
  // },
  // // ── 无酒精 / 低酒精 ──
  // {
  //   id: 21, emoji:'🍃', name:'薄荷柠檬水', base:'无酒精', style:'清爽', abv:0, difficulty:1,
  //   desc:'清新解渴的无酒精选项，适合全客群。',
  //   ingredients:[
  //     { name:'柠檬汁', amount:'30ml' }, { name:'简单糖浆', amount:'20ml' },
  //     { name:'薄荷叶', amount:'10片' }, { name:'苏打水', amount:'150ml' },
  //   ],
  //   steps:['薄荷叶与糖浆轻捣','加入柠檬汁','填满冰块','苏打水补满','薄荷枝装饰'],
  //   notes:'可加少量玫瑰水增添花香。'
  // },
  // {
  //   id: 22, emoji:'🫧', name:'西柚苏打', base:'无酒精', style:'清爽', abv:0, difficulty:1,
  //   desc:'苦甜交织的无酒精清爽饮品。',
  //   ingredients:[
  //     { name:'西柚汁', amount:'60ml' }, { name:'简单糖浆', amount:'15ml' },
  //     { name:'苏打水', amount:'120ml' }, { name:'迷迭香', amount:'1枝' },
  //   ],
  //   steps:['杯中加冰','加入西柚汁和糖浆','注入苏打水','迷迭香轻拍后装饰'],
  //   notes:'迷迭香轻拍可激活香气。'
  // },
  // // ── 热饮 ──
  // {
  //   id: 23, emoji:'☕', name:'爱尔兰咖啡', base:'威士忌', style:'热饮', abv:10, difficulty:2,
  //   desc:'咖啡与威士忌的暖心结合，奶油帽子是重点。',
  //   ingredients:[
  //     { name:'爱尔兰威士忌', amount:'40ml' }, { name:'热咖啡', amount:'120ml' },
  //     { name:'简单糖浆', amount:'15ml' }, { name:'鲜奶油', amount:'30ml' },
  //   ],
  //   steps:['预热爱尔兰咖啡杯','加入糖浆和威士忌','倒入热咖啡至八分满','奶油打发后沿勺背缓慢浇入'],
  //   notes:'奶油不要搅拌，透过奶油喝咖啡是正确方式。'
  // },
  // {
  //   id: 24, emoji:'🍎', name:'热苹果酒', base:'苹果酒', style:'热饮', abv:5, difficulty:1,
  //   desc:'秋冬季节的温暖选择，香料香气迷人。',
  //   ingredients:[
  //     { name:'苹果汁', amount:'200ml' }, { name:'肉桂棒', amount:'1根' },
  //     { name:'丁香', amount:'3粒' }, { name:'八角', amount:'1颗' },
  //     { name:'简单糖浆', amount:'10ml' },
  //   ],
  //   steps:['所有原料放入小锅','小火加热至微沸','过滤倒入马克杯','肉桂棒装饰'],
  //   notes:'可加少量波本威士忌制成热托地。'
  // },
  // // ── 创意 / 签名酒 ──
  // {
  //   id: 25, emoji:'🌺', name:'玫瑰马天尼', base:'伏特加', style:'创意', abv:22, difficulty:2,
  //   desc:'优雅的玫瑰风味，适合特定节日氛围。',
  //   ingredients:[
  //     { name:'伏特加', amount:'45ml' }, { name:'玫瑰糖浆', amount:'15ml' },
  //     { name:'荔枝利口酒', amount:'15ml' }, { name:'青柠汁', amount:'10ml' },
  //   ],
  //   steps:['摇酒壶加冰','加入所有原料','摇匀12秒','过滤倒入马天尼杯','干玫瑰花瓣装饰'],
  //   notes:'玫瑰糖浆用量决定花香浓度。'
  // },
  // {
  //   id: 26, emoji:'🍵', name:'抹茶金酒', base:'金酒', style:'创意', abv:20, difficulty:3,
  //   desc:'东西方风味融合，独特的苦涩与清香。',
  //   ingredients:[
  //     { name:'金酒', amount:'45ml' }, { name:'抹茶糖浆', amount:'15ml' },
  //     { name:'青柠汁', amount:'15ml' }, { name:'蜂蜜', amount:'10ml' },
  //     { name:'蛋清', amount:'1个' },
  //   ],
  //   steps:['不加冰干摇15秒','加冰再摇15秒','过滤倒入岩石杯','抹茶粉筛装饰'],
  //   notes:'抹茶糖浆提前制作：等量抹茶粉溶于糖水中。'
  // },
  // {
  //   id: 27, emoji:'🫐', name:'蓝莓姜汁司令', base:'金酒', style:'创意', abv:12, difficulty:2,
  //   desc:'本地浆果与辛辣姜汁的创意组合。',
  //   ingredients:[
  //     { name:'金酒', amount:'45ml' }, { name:'新鲜蓝莓', amount:'8颗' },
  //     { name:'姜汁糖浆', amount:'20ml' }, { name:'柠檬汁', amount:'15ml' },
  //     { name:'苏打水', amount:'60ml' },
  //   ],
  //   steps:['蓝莓轻压出汁','加入其他原料和冰','摇匀后过滤倒入高球杯','苏打水顶满','蓝莓串装饰'],
  //   notes:'新鲜蓝莓轻压即可，不要完全碾碎。'
  // },
  // {
  //   id: 28, emoji:'🥭', name:'芒果辣椒玛格', base:'龙舌兰', style:'创意', abv:18, difficulty:3,
  //   desc:'甜辣结合的独特体验，夏日特饮。',
  //   ingredients:[
  //     { name:'银龙舌兰', amount:'45ml' }, { name:'芒果汁', amount:'30ml' },
  //     { name:'青柠汁', amount:'20ml' }, { name:'辣椒糖浆', amount:'10ml' },
  //     { name:'辣椒盐边', amount:'适量' },
  //   ],
  //   steps:['辣椒盐制作杯口盐边','摇酒壶加冰','加入所有原料','摇匀后过滤倒入','薄芒果片装饰'],
  //   notes:'辣椒糖浆：糖水加新鲜辣椒片浸泡24小时。'
  // },
  // {
  //   id: 29, emoji:'🍇', name:'黑加仑司令', base:'伏特加', style:'创意', abv:14, difficulty:2,
  //   desc:'紫色渐变视觉冲击，果味浓郁。',
  //   ingredients:[
  //     { name:'伏特加', amount:'45ml' }, { name:'黑加仑利口酒', amount:'20ml' },
  //     { name:'柠檬汁', amount:'15ml' }, { name:'苏打水', amount:'80ml' },
  //   ],
  //   steps:['加冰至高球杯','加入伏特加和柠檬汁','苏打水补满','沿壁缓倒黑加仑利口酒（不搅）','柠檬片装饰'],
  //   notes:'黑加仑最后加，自然沉底形成渐变。'
  // },
  // {
  //   id: 30, emoji:'🥑', name:'皮斯科酸', base:'皮斯科', style:'经典', abv:18, difficulty:3,
  //   desc:'秘鲁国酒，蛋清泡沫与苦精是其精华。',
  //   ingredients:[
  //     { name:'皮斯科', amount:'60ml' }, { name:'青柠汁', amount:'30ml' },
  //     { name:'简单糖浆', amount:'20ml' }, { name:'蛋清', amount:'1个' },
  //     { name:'安格仕苦精', amount:'3滴' },
  //   ],
  //   steps:['不加冰干摇20秒','加冰再摇15秒','过滤倒入岩石杯','苦精在泡沫上点缀'],
  //   notes:'干摇时间越长泡沫越丰富。'
  // },
]

module.exports = { RECIPES }

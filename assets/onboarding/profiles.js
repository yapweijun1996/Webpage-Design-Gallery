/** Example integration profiles; applications supply their real supported bindings. */
const key = value => ({key:value});
const text = value => ({text:value});
export function createExperienceProfile(kind = 'mall') {
  const titles = {
    mall: ['GJH Virtual Mall','Explore a new way to shop.','探索全新的购物方式。'],
    gallery: ['3D Gallery','Discover a different perspective.','发现不一样的视角。'],
    hotel: ['Hotel','Make yourself at home.','探索你的入住空间。'],
    parking: ['Parking','Find your way around.','轻松了解停车空间。'],
    showroom: ['Product Showroom','Take a closer look.','近距离探索产品。'],
    other: ['3D Experience','Explore at your own pace.','按自己的节奏探索。'],
  };
  const [appName,en,zh] = titles[kind] || titles.other;
  const domainActions={
    mall:[['Choose a store','Browse directory'],['选择店铺','浏览目录']],
    gallery:[['View gallery map','Browse exhibits'],['查看展馆地图','浏览展品']],
    hotel:[['View floor plan','Browse rooms'],['查看楼层图','浏览客房']],
    parking:[['View parking plan','Browse parking areas'],['查看停车平面图','浏览停车区域']],
    showroom:[['Choose a display','Browse products'],['选择展区','浏览产品']],
    other:[['Open map','Browse directory'],['打开地图','浏览目录']],
  };
  const labels=domainActions[kind]||domainActions.other;

  return {appName,copy:{en:{title:en,actions:{map:labels[0][0],list:labels[0][1]},description:'Move through the space, look around, and inspect what interests you.'},'zh-CN':{title:zh,actions:{map:labels[1][0],list:labels[1][1]},description:'自由移动、环顾四周，近距离查看感兴趣的内容。'}},steps:[
    {id:'move',label:{en:'Move','zh-CN':'移动'},bindings:{
      keyboard:{en:[...['W','A','S','D'].map(key),text('or arrows')],'zh-CN':[...['W','A','S','D'].map(key),text('或方向键')]},
      touch:{en:[text('Drag to move')],'zh-CN':[text('拖动移动')]},
      gamepad:{en:[text('Left stick')],'zh-CN':[text('左摇杆')]},
    }},
    {id:'look',label:{en:'Look around','zh-CN':'环顾四周'},bindings:{
      keyboard:{en:[text('Drag /'),key('Q'),key('E')],'zh-CN':[text('拖动 /'),key('Q'),key('E')]},
      touch:{en:[text('Hold one finger; swipe with a second')],'zh-CN':[text('保持一指按住，第二指滑动')]},
      gamepad:{en:[text('Right stick')],'zh-CN':[text('右摇杆')]},
    }},
    {id:'inspect',label:{en:'Inspect','zh-CN':'查看'},bindings:{
      keyboard:{en:[key('F'),text('near a display')],'zh-CN':[text('靠近展品按'),key('F')]},
      touch:{en:[text('Tap the context button')],'zh-CN':[text('点击情境操作按钮')]},
      gamepad:{en:[key('A'),text('near a display')],'zh-CN':[text('靠近展品按'),key('A')]},
    }},
  ]};
}

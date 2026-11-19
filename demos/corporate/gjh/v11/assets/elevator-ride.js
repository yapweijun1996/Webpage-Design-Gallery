// Fixed-step choreography in seconds. Kinematic positions and collider
// ownership continue to come from the existing player and stop controllers.
export const rideTime = Object.freeze({open:.22, board:.55, close:.78, arrive:1.36, reopen:1.58, exit:1.84});
export function easedInterval(time,start,end) {
  const t=Math.max(0,Math.min(1,(time-start)/(end-start)));
  return t*t*(3-2*t);
}

export function sampleRide(time,trip) {
  const {open,board,close,arrive,reopen,exit}=rideTime;
  const entering=easedInterval(time,open,board), leaving=easedInterval(time,reopen,exit);
  const y=trip.from+(trip.to-trip.from)*easedInterval(time,close,arrive);
  const position=trip.position;
  position.x=trip.startX+(trip.x-trip.startX)*entering+(trip.exitX-trip.x)*leaving;
  position.z=trip.startZ+(trip.z-trip.startZ)*entering+(trip.exitZ-trip.z)*leaving;
  position.y=y+.89;
  const source=easedInterval(time,0,open)*(1-easedInterval(time,board,close));
  const destination=easedInterval(time,arrive,reopen);
  trip.groundDoor=trip.from===0 ? source : destination;
  trip.upperDoor=trip.from===0 ? destination : source;
  trip.height=y;
  trip.phase=time<board ? 'board' : time<arrive ? 'ride' : 'exit';
}


export const floorDestinations = Object.freeze({
  'floor-upper': Object.freeze({label:'Upper level', upper:true}),
  'floor-ground': Object.freeze({label:'Ground floor', upper:false}),
});

export function elevatorRideBlockReason({pushing, seated, elevatorTravel, physicalProduct, productApproaching}) {
  if (elevatorTravel) return 'Wait for the elevator to stop.';
  if (pushing) return 'Stow your cart from Bag before riding the elevator.';
  if (physicalProduct && physicalProduct.phase !== 'empty' || productApproaching) {
    return 'Return the held product to its shelf or add it to your bag before riding the elevator.';
  }
  if (seated) return 'Stand up before riding the elevator.';
  return '';
}

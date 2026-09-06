(Este es un archivo de instrucciones, archivar al terminar de implementar).

Trabajaremos en el flujo de queque de canciones.

Primero que nada, el flujo necesita un "rate limiter". Las recomendaciones para la queue deberían añadirse en un grupo de 5 (que son las "siguientes canciones recomendadas" para no sobre-saturar la cola). Estas se añaden una vez por canción, y en caso de querer hacer modificaciones, se debe "sobre-escribir" esta queue en lugar de añadir más al final.

Para hacer una modificación a la cola debe haber un cambio notable (10 - 15 bpm) del BPM actual del usuario, de forma que las recomendaciones no se estén modificando constantemente.

En el flujo como está implementado actualmente, la revisión y añadido a la cola se hace cada ciclo de 5 segundos, lo que hace que la cola se sobre-sature, se hagan muchísimas API calls y el sistema se rompa. Esto se debe corregir.

IMPORTANTE: Las recomendaciones dinámicas deben sobre-escribir a las anteriores en la queue, no apilarse sobre las que ya están (en el flujo actual, las recomendaciones nuevas se añaden a la queue, haciendo que se tenga que escuchar de cualquier manera las que ya se habían escuchado antes).

Para poder tener en cuenta las canciones que se han recomendado, mantén un registro local en la aplicación de las canciones que se han recomendado.

Asimismo, debe haber un sistema en contra de la repetición de canciones. Una vez una canción ha sido recomendada, en un scope de las siguientes x canciones (15 como valor default, pero que sea elegible por el usuario en un menú de configuración que haremos próximamente, deja una nota en un archivo .md de los aspectos que hemos hablado que deben haber en una ventana de configuración).

Finalmente, parece haber un error constante con el parseo de JSON. Puedes revisarlo en la interfaz desde el navegador utilizando claude-in-chrome. Investiga este error y corrígelo.
